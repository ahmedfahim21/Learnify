import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { topics } from "@/db/schema";
import { TopicsClient } from "@/components/topics/TopicsClient";
import { getDemoUserId } from "@/lib/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  const db = getDb();
  const userId = await getDemoUserId();
  const rows = await db
    .select({ id: topics.id, title: topics.title })
    .from(topics)
    .where(eq(topics.userId, userId))
    .orderBy(desc(topics.createdAt));

  return (
    <main className="min-h-screen">
      <TopicsClient initialTopics={rows} />
    </main>
  );
}
