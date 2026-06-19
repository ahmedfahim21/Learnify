import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { concepts, sessions, topics } from "@/db/schema";
import { getDemoUserId } from "@/lib/demo";

export const runtime = "nodejs";

/**
 * Start a learning session against a topic.
 *
 * Phase 1 only has one session kind ("learn"); the `kind` field is accepted for
 * forward-compatibility but not yet persisted (review sessions arrive in #43).
 *
 * An optional `conceptIds` array (from the topic's concept graph, #42) focuses
 * the session on selected concepts: they're resolved to names/slugs and seeded
 * into the session plan so the tutor's opening snapshot teaches them in order.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { topicId?: unknown; conceptIds?: unknown };
  try {
    body = (await request.json()) as { topicId?: unknown; conceptIds?: unknown };
  } catch {
    body = {};
  }

  const topicId = typeof body.topicId === "string" ? body.topicId : "";
  if (!topicId) {
    return Response.json({ error: "topicId is required" }, { status: 400 });
  }

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
        phase: "diagnostic",
        remainingConceptIds: targeted.map((c) => c.slug),
        focus: targeted.map((c) => c.name),
      };
    }
  }

  const [session] = await db
    .insert(sessions)
    .values({ userId, topicId, status: "active", plan })
    .returning();

  return Response.json({ session }, { status: 201 });
}
