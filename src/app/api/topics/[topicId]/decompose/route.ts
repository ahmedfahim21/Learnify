import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { conceptEdges, concepts, topics } from "@/db/schema";
import { generateConceptGraph } from "@/lib/agent/conceptGraph";
import { getDemoUserId } from "@/lib/demo";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Decompose a topic into its prerequisite concept graph.
 *
 * Idempotent and concurrency-safe: it atomically claims the topic by flipping
 * `new`/`failed` → `decomposing` in a single conditional UPDATE. If no row is
 * claimed, another run is already in flight (or the topic is already `ready`),
 * so we just report the current status instead of decomposing twice.
 *
 * (neon-http has no interactive transactions, so the claim is the conditional
 * UPDATE and we rebuild the graph from a clean slate inside the claim.)
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ topicId: string }> },
): Promise<Response> {
  const { topicId } = await params;
  const db = getDb();
  const userId = await getDemoUserId();

  // Atomically claim the topic for decomposition.
  const claimed = await db
    .update(topics)
    .set({ status: "decomposing" })
    .where(
      and(
        eq(topics.id, topicId),
        eq(topics.userId, userId),
        inArray(topics.status, ["new", "failed"]),
      ),
    )
    .returning({ id: topics.id, title: topics.title });

  if (claimed.length === 0) {
    // Not claimable — fetch why (already running, ready, or not found).
    const [existing] = await db
      .select({ status: topics.status })
      .from(topics)
      .where(and(eq(topics.id, topicId), eq(topics.userId, userId)))
      .limit(1);
    if (!existing) {
      return Response.json({ error: "topic not found" }, { status: 404 });
    }
    return Response.json({ status: existing.status });
  }

  const { title } = claimed[0];

  try {
    const graph = await generateConceptGraph(title);

    // Clean slate: a re-decomposition (after a prior failure) replaces any
    // partial concepts. Cascades remove their edges.
    await db.delete(concepts).where(eq(concepts.topicId, topicId));

    const insertedConcepts = await db
      .insert(concepts)
      .values(
        graph.concepts.map((c) => ({
          topicId,
          slug: c.slug,
          name: c.name,
          summary: c.summary,
          difficulty: c.difficulty,
          orderIndex: c.orderIndex,
        })),
      )
      .returning({ id: concepts.id, slug: concepts.slug });

    const idBySlug = new Map(insertedConcepts.map((c) => [c.slug, c.id]));

    const edgeValues = graph.edges
      .map((e) => ({
        topicId,
        fromConceptId: idBySlug.get(e.from),
        toConceptId: idBySlug.get(e.to),
      }))
      .filter(
        (e): e is { topicId: string; fromConceptId: string; toConceptId: string } =>
          Boolean(e.fromConceptId && e.toConceptId),
      );

    if (edgeValues.length > 0) {
      await db.insert(conceptEdges).values(edgeValues);
    }

    await db
      .update(topics)
      .set({ status: "ready" })
      .where(eq(topics.id, topicId));

    return Response.json({
      status: "ready",
      conceptCount: insertedConcepts.length,
      edgeCount: edgeValues.length,
    });
  } catch (error) {
    await db
      .update(topics)
      .set({ status: "failed" })
      .where(eq(topics.id, topicId));
    const message =
      error instanceof Error ? error.message : "decomposition failed";
    return Response.json({ status: "failed", error: message }, { status: 500 });
  }
}
