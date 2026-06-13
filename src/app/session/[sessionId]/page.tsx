import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { getDb } from "@/db";
import { sessionEvents, sessions, topics } from "@/db/schema";
import { Classroom } from "@/components/classroom/Classroom";
import {
  replaySurfaceMessages,
  sessionSurfaceId,
} from "@/lib/agent/replay";
import type { EventPayload, StoredEvent } from "@/lib/agent/transcript";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const db = getDb();

  const [session] = await db
    .select({ id: sessions.id, topicId: sessions.topicId, status: sessions.status })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!session) notFound();

  const [topic] = await db
    .select({ title: topics.title })
    .from(topics)
    .where(eq(topics.id, session.topicId))
    .limit(1);

  const rows = await db
    .select({ seq: sessionEvents.seq, role: sessionEvents.role, payload: sessionEvents.payload })
    .from(sessionEvents)
    .where(eq(sessionEvents.sessionId, sessionId))
    .orderBy(asc(sessionEvents.seq));

  const stored: StoredEvent[] = rows.map((row) => ({
    seq: row.seq,
    role: row.role as StoredEvent["role"],
    payload: row.payload as EventPayload,
  }));

  const initialMessages = replaySurfaceMessages(
    stored,
    sessionSurfaceId(sessionId),
  );

  return (
    <main className="min-h-screen">
      <Classroom
        sessionId={sessionId}
        topicTitle={topic?.title ?? "Session"}
        initialMessages={initialMessages}
        sessionStatus={session.status}
      />
    </main>
  );
}
