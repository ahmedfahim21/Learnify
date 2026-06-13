import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { topics } from "@/db/schema";
import { getDemoUserId } from "@/lib/demo";

export const runtime = "nodejs";

/** List the demo learner's topics, newest first. */
export async function GET(): Promise<Response> {
  const db = getDb();
  const userId = await getDemoUserId();
  const rows = await db
    .select()
    .from(topics)
    .where(eq(topics.userId, userId))
    .orderBy(desc(topics.createdAt));
  return Response.json({ topics: rows });
}

/** Create a topic for the demo learner. */
export async function POST(request: Request): Promise<Response> {
  let body: { title?: unknown };
  try {
    body = (await request.json()) as { title?: unknown };
  } catch {
    body = {};
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  const db = getDb();
  const userId = await getDemoUserId();
  const [topic] = await db
    .insert(topics)
    .values({ userId, title })
    .returning();

  return Response.json({ topic }, { status: 201 });
}
