import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { conceptEdges, concepts, topics } from "@/db/schema";
import { getProblem } from "@/content/systemDesign";
import { chainEdges, flattenConcepts } from "@/content/systemDesign/types";

/**
 * Turn a curated course into a ready topic + concept DAG for a user,
 * bypassing LLM decomposition entirely. Idempotent: a second call for the
 * same (user, slug) returns the existing topic and writes nothing new —
 * guarded by the `topics_user_problem_unique` index, the same
 * insert-then-reselect race-safe pattern `getDemoUserId` uses.
 */
export async function materializeProblem(
  userId: string,
  slug: string,
): Promise<{ topicId: string; created: boolean }> {
  const problem = getProblem(slug);
  if (!problem) {
    throw new Error(`Unknown course slug: "${slug}"`);
  }

  const db = getDb();

  const [existing] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.userId, userId), eq(topics.problemSlug, slug)))
    .limit(1);
  if (existing) {
    return { topicId: existing.id, created: false };
  }

  await db
    .insert(topics)
    .values({
      userId,
      title: problem.title,
      kind: "curated",
      problemSlug: slug,
      status: "ready",
    })
    .onConflictDoNothing({ target: [topics.userId, topics.problemSlug] });

  const [topic] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.userId, userId), eq(topics.problemSlug, slug)))
    .limit(1);
  if (!topic) {
    // Lost a genuine race with a concurrent insert that then failed for some
    // other reason — vanishingly unlikely, but fail loudly rather than
    // silently returning a bogus id.
    throw new Error(`Failed to materialize course "${slug}" for user ${userId}`);
  }

  const authoredConcepts = flattenConcepts(problem);
  const inserted = await db
    .insert(concepts)
    .values(
      authoredConcepts.map((concept, index) => ({
        topicId: topic.id,
        slug: concept.slug,
        name: concept.name,
        summary: concept.summary,
        difficulty: concept.difficulty,
        orderIndex: index,
        phase: concept.phase,
      })),
    )
    .onConflictDoNothing({ target: [concepts.topicId, concepts.slug] })
    .returning({ id: concepts.id, slug: concepts.slug });

  const idBySlug = new Map(inserted.map((c) => [c.slug, c.id]));
  const edges = chainEdges(problem)
    .map((edge) => {
      const fromConceptId = idBySlug.get(edge.from);
      const toConceptId = idBySlug.get(edge.to);
      return fromConceptId && toConceptId ? { topicId: topic.id, fromConceptId, toConceptId } : null;
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  if (edges.length > 0) {
    await db.insert(conceptEdges).values(edges).onConflictDoNothing();
  }

  return { topicId: topic.id, created: true };
}
