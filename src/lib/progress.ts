import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { concepts, courseProgress, mastery, topics } from "@/db/schema";
import { PROBLEMS } from "@/content/systemDesign";
import type { SkillTag } from "@/content/systemDesign/tags";

/**
 * Reading progress and mastery, rolled up per course.
 *
 * Progress is recorded against the course slug and chapter phase rather than
 * a topic id, because reading a course materializes nothing — a learner can
 * finish every chapter without ever starting a tutoring session.
 */

export interface CourseProgressSummary {
  problemSlug: string;
  /** Chapter phases the learner has completed. */
  completedPhases: string[];
  totalChapters: number;
  /** 0–1. */
  fraction: number;
}

/** Mark one chapter read. Idempotent — re-reading doesn't duplicate a row. */
export async function markChapterComplete(
  userId: string,
  problemSlug: string,
  phase: string,
): Promise<void> {
  await getDb()
    .insert(courseProgress)
    .values({ userId, problemSlug, phase })
    .onConflictDoNothing({
      target: [courseProgress.userId, courseProgress.problemSlug, courseProgress.phase],
    });
}

export async function getCourseProgress(userId: string): Promise<CourseProgressSummary[]> {
  const rows = await getDb()
    .select({ problemSlug: courseProgress.problemSlug, phase: courseProgress.phase })
    .from(courseProgress)
    .where(eq(courseProgress.userId, userId));

  const byCourse = new Map<string, string[]>();
  for (const row of rows) {
    byCourse.set(row.problemSlug, [...(byCourse.get(row.problemSlug) ?? []), row.phase]);
  }

  return PROBLEMS.map((problem) => {
    const completed = byCourse.get(problem.slug) ?? [];
    return {
      problemSlug: problem.slug,
      completedPhases: completed,
      totalChapters: problem.chapters.length,
      fraction: problem.chapters.length === 0 ? 0 : completed.length / problem.chapters.length,
    };
  });
}

export type SkillState = "mastered" | "practised" | "read" | "unseen";

export interface KnowledgeNode {
  /** Stable across sessions: the course slug plus the skill slug. */
  id: string;
  slug: string;
  name: string;
  summary: string;
  phase: string;
  /** 0–1 from the mastery engine, or null when never assessed. */
  score: number | null;
  state: SkillState;
  problemSlug: string;
  courseTitle: string;
  tags: SkillTag[];
}

/** A theme two or more skills share — the graph's connective tissue. */
export interface KnowledgeTag {
  tag: SkillTag;
  /** Ids of the skills reached under this theme. */
  skillIds: string[];
  /** How many distinct concepts those skills came from. */
  conceptCount: number;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  tags: KnowledgeTag[];
  /** Skill -> theme. The only edges: a chain within one concept says nothing
   *  a reading list doesn't already say. */
  edges: { from: string; to: string }[];
}

/**
 * Everything this learner has touched, as a graph.
 *
 * Built from the authored curriculum rather than from materialized DB rows,
 * because reading a concept materializes nothing — a learner can finish every
 * chapter of six concepts without ever starting a tutor session, and a graph
 * that ignored all of that would be empty for exactly the people using the
 * product most.
 *
 * A skill therefore appears once its chapter has been completed (`read`), and
 * is upgraded to `practised` or `mastered` when the mastery engine has an
 * actual score for it. Untouched skills are left out entirely: a graph
 * pre-populated with the whole curriculum says nothing about anyone.
 */
export async function getKnowledgeGraph(userId: string): Promise<KnowledgeGraph> {
  const db = getDb();

  const [progressRows, masteryRows] = await Promise.all([
    db
      .select({ problemSlug: courseProgress.problemSlug, phase: courseProgress.phase })
      .from(courseProgress)
      .where(eq(courseProgress.userId, userId)),
    // Scores live against materialized concepts, so they are keyed back to the
    // authored content by (course slug, skill slug).
    db
      .select({
        problemSlug: topics.problemSlug,
        conceptSlug: concepts.slug,
        score: mastery.score,
      })
      .from(mastery)
      .innerJoin(concepts, eq(mastery.conceptId, concepts.id))
      .innerJoin(topics, eq(concepts.topicId, topics.id))
      .where(eq(mastery.userId, userId)),
  ]);

  const readPhases = new Map<string, Set<string>>();
  for (const row of progressRows) {
    const set = readPhases.get(row.problemSlug) ?? new Set<string>();
    set.add(row.phase);
    readPhases.set(row.problemSlug, set);
  }

  const scores = new Map<string, number>();
  for (const row of masteryRows) {
    if (row.problemSlug) scores.set(`${row.problemSlug}:${row.conceptSlug}`, row.score);
  }

  const nodes: KnowledgeNode[] = [];

  for (const problem of PROBLEMS) {
    const read = readPhases.get(problem.slug);

    for (const chapter of problem.chapters) {
      const chapterRead = read?.has(chapter.phase) ?? false;
      for (const skill of chapter.concepts) {
        const key = `${problem.slug}:${skill.slug}`;
        const score = scores.get(key) ?? null;
        if (!chapterRead && score === null) continue;

        nodes.push({
          id: key,
          slug: skill.slug,
          name: skill.name,
          summary: skill.summary,
          phase: chapter.phase,
          score,
          state: score === null ? "read" : score >= 0.8 ? "mastered" : "practised",
          problemSlug: problem.slug,
          courseTitle: problem.title,
          tags: skill.tags,
        });
      }
    }
  }

  // Themes are the structure. A chain through one concept's skills in reading
  // order only redraws the table of contents; what a learner cannot see any
  // other way is that the partitioning in a key-value store and the consistent
  // hashing in a cache are the same idea, met twice.
  const byTag = new Map<SkillTag, { skillIds: string[]; concepts: Set<string> }>();
  for (const node of nodes) {
    for (const tag of node.tags) {
      const bucket = byTag.get(tag) ?? { skillIds: [], concepts: new Set<string>() };
      bucket.skillIds.push(node.id);
      bucket.concepts.add(node.problemSlug);
      byTag.set(tag, bucket);
    }
  }

  // A theme reached exactly once is not yet a connection, and drawing it as a
  // hub with a single spoke makes the graph look busier without saying more.
  const tags: KnowledgeTag[] = [...byTag.entries()]
    .filter(([, bucket]) => bucket.skillIds.length > 1)
    .map(([tag, bucket]) => ({
      tag,
      skillIds: bucket.skillIds,
      conceptCount: bucket.concepts.size,
    }))
    .sort((a, b) => b.skillIds.length - a.skillIds.length);

  const edges = tags.flatMap((entry) =>
    entry.skillIds.map((skillId) => ({ from: skillId, to: `tag:${entry.tag}` })),
  );

  return { nodes, tags, edges };
}
