import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { concepts, sessions, topics } from "@/db/schema";
import { getDemoUserId } from "@/lib/demo";

export const runtime = "nodejs";

/**
 * Start a learning session against a topic.
 *
 * Two kinds (#43): "learn" (default — first-time teaching) and "review" (a
 * spaced-repetition pass; the tutor runs flashcard-heavy off the due queue).
 * The kind is persisted on the session and seeds the tutor's opening snapshot.
 *
 * An optional `conceptIds` array (from the topic's concept graph, #42, or the
 * Today due queue) focuses the session on selected concepts: they're resolved to
 * names/slugs and seeded into the session plan so the tutor teaches/reviews them
 * in order.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { topicId?: unknown; conceptIds?: unknown; kind?: unknown };
  try {
    body = (await request.json()) as {
      topicId?: unknown;
      conceptIds?: unknown;
      kind?: unknown;
    };
  } catch {
    body = {};
  }

  const topicId = typeof body.topicId === "string" ? body.topicId : "";
  if (!topicId) {
    return Response.json({ error: "topicId is required" }, { status: 400 });
  }

  const kind = body.kind === "review" ? "review" : "learn";

  const conceptIds = Array.isArray(body.conceptIds)
    ? body.conceptIds.filter((id): id is string => typeof id === "string")
    : [];

  const db = getDb();
  const userId = await getDemoUserId();

  // Scope the topic to the demo learner so sessions can't target others' topics.
  const [topic] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.id, topicId), eq(topics.userId, userId)))
    .limit(1);
  if (!topic) {
    return Response.json({ error: "topic not found" }, { status: 404 });
  }

  // Resolve any targeted concepts (scoped to this topic) into an initial plan,
  // ordered by topological rank so the tutor teaches prerequisites first.
  let plan:
    | { phase: string; remainingConceptIds: string[]; focus: string[] }
    | null = null;
  if (conceptIds.length > 0) {
    const targeted = await db
      .select({
        slug: concepts.slug,
        name: concepts.name,
        orderIndex: concepts.orderIndex,
      })
      .from(concepts)
      .where(and(eq(concepts.topicId, topicId), inArray(concepts.id, conceptIds)))
      .orderBy(concepts.orderIndex);
    if (targeted.length > 0) {
      plan = {
        // Reviews skip diagnostics and jump straight to retrieval practice.
        phase: kind === "review" ? "assess" : "diagnostic",
        remainingConceptIds: targeted.map((c) => c.slug),
        focus: targeted.map((c) => c.name),
      };
    }
  }

  const [session] = await db
    .insert(sessions)
    .values({ userId, topicId, kind, status: "active", plan })
    .returning();

  return Response.json({ session }, { status: 201 });
}
