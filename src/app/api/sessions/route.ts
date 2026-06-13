import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { sessions, topics } from "@/db/schema";
import { getDemoUserId } from "@/lib/demo";

export const runtime = "nodejs";

/**
 * Start a learning session against a topic.
 *
 * Phase 1 only has one session kind ("learn"); the `kind` field is accepted for
 * forward-compatibility but not yet persisted (review sessions arrive in #43).
 */
export async function POST(request: Request): Promise<Response> {
  let body: { topicId?: unknown };
  try {
    body = (await request.json()) as { topicId?: unknown };
  } catch {
    body = {};
  }

  const topicId = typeof body.topicId === "string" ? body.topicId : "";
  if (!topicId) {
    return Response.json({ error: "topicId is required" }, { status: 400 });
  }

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

  const [session] = await db
    .insert(sessions)
    .values({ userId, topicId, status: "active" })
    .returning();

  return Response.json({ session }, { status: 201 });
}
