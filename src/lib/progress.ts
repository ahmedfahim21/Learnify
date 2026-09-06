import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { concepts, courseProgress, mastery, topics } from "@/db/schema";
import { PROBLEMS } from "@/content/systemDesign";

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

export interface KnowledgeNode {
  conceptId: string;
  slug: string;
  name: string;
  summary: string;
  phase: string | null;
  /** 0–1, or null when this concept has never been assessed. */
  score: number | null;
  problemSlug: string | null;
  courseTitle: string;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  /** Prerequisite edges, by concept id. */
  edges: { from: string; to: string }[];
}

/**
 * Every concept this learner has materialized, with its mastery score.
 *
 * Only courses they've actually started appear — a graph pre-populated with
 * all 16 courses would say nothing about what they know.
 */
export async function getKnowledgeGraph(userId: string): Promise<KnowledgeGraph> {
  const db = getDb();
  const rows = await db
    .select({
      conceptId: concepts.id,
      slug: concepts.slug,
      name: concepts.name,
      summary: concepts.summary,
      phase: concepts.phase,
      orderIndex: concepts.orderIndex,
      problemSlug: topics.problemSlug,
      courseTitle: topics.title,
      score: mastery.score,
    })
    .from(concepts)
    .innerJoin(topics, eq(concepts.topicId, topics.id))
    .leftJoin(
      mastery,
      and(eq(mastery.conceptId, concepts.id), eq(mastery.userId, userId)),
    )
    .where(eq(topics.userId, userId))
    .orderBy(topics.title, concepts.orderIndex);

  const nodes: KnowledgeNode[] = rows.map((r) => ({
    conceptId: r.conceptId,
    slug: r.slug,
    name: r.name,
    summary: r.summary,
    phase: r.phase,
    score: r.score,
    problemSlug: r.problemSlug,
    courseTitle: r.courseTitle,
  }));

  const edgeRows = await db.execute<{ from_concept_id: string; to_concept_id: string }>(sql`
    SELECT ce.from_concept_id, ce.to_concept_id
    FROM concept_edges ce
    JOIN topics t ON t.id = ce.topic_id
    WHERE t.user_id = ${userId}
  `);

  return {
    nodes,
    edges: (edgeRows.rows ?? []).map((e) => ({ from: e.from_concept_id, to: e.to_concept_id })),
  };
}
