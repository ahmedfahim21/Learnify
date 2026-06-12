import { asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { sessionEvents, sessions, topics } from "@/db/schema";
import { runTurn, type TurnFrame } from "@/lib/agent/loop";
import {
  buildMessages,
  EventKind,
  type EventPayload,
  type StoredEvent,
} from "@/lib/agent/transcript";
import { renderLearnerSnapshot } from "@/lib/agent/prompts";

export const runtime = "nodejs";
export const maxDuration = 300;

interface TurnRequestBody {
  /** A new learner message for this turn (resumed sessions). */
  message?: string;
  /** Optional topic title to seed a brand-new session. */
  topicTitle?: string;
  /** Optional learner notes (how they learn). */
  learnerNotes?: string;
}

const SURFACE_PREFIX = "session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const surfaceId = `${SURFACE_PREFIX}:${sessionId}`;

  let body: TurnRequestBody = {};
  try {
    body = (await request.json()) as TurnRequestBody;
  } catch {
    // Empty body is valid (e.g. resuming after a dropped stream).
  }

  const db = getDb();

  // Confirm the session exists and grab its topic title for the snapshot.
  const [session] = await db
    .select({ id: sessions.id, topicId: sessions.topicId })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session) {
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  // Replay the append-only transcript.
  const rows = await db
    .select({
      seq: sessionEvents.seq,
      role: sessionEvents.role,
      payload: sessionEvents.payload,
    })
    .from(sessionEvents)
    .where(eq(sessionEvents.sessionId, sessionId))
    .orderBy(asc(sessionEvents.seq));

  const stored: StoredEvent[] = rows.map((r) => ({
    seq: r.seq,
    role: r.role as StoredEvent["role"],
    payload: r.payload as EventPayload,
  }));

  let nextSeq = stored.reduce((m, e) => Math.max(m, e.seq), 0) + 1;

  // Resolve the topic title (body wins; else look it up).
  let topicTitle = body.topicTitle;
  if (!topicTitle) {
    const [topic] = await db
      .select({ title: topics.title })
      .from(topics)
      .where(eq(topics.id, session.topicId))
      .limit(1);
    topicTitle = topic?.title ?? "your topic";
  }

  // Insert an event, assigning the next seq.
  async function insertEvent(
    role: "tutor" | "user" | "system",
    type: string,
    payload: unknown,
  ): Promise<void> {
    await db.insert(sessionEvents).values({
      sessionId,
      seq: nextSeq++,
      type,
      role,
      payload: payload as object,
    });
  }

  // Seed a brand-new session, or record this turn's incoming message.
  const hasHistory = stored.length > 0;
  if (!hasHistory) {
    const text = renderLearnerSnapshot({
      topicTitle,
      learnerNotes: body.learnerNotes,
    });
    const payload: EventPayload = { kind: EventKind.UserMessage, text };
    await insertEvent("user", payload.kind, payload);
    stored.push({ seq: nextSeq - 1, role: "user", payload });
  } else if (body.message) {
    const payload: EventPayload = {
      kind: EventKind.UserMessage,
      text: body.message,
    };
    await insertEvent("user", payload.kind, payload);
    stored.push({ seq: nextSeq - 1, role: "user", payload });
  }

  const messages = buildMessages(stored);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (frame: TurnFrame) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
      };

      try {
        await runTurn({
          messages,
          surfaceId,
          emit: send,
          persist: (role, payload) => insertEvent(role, payload.kind, payload),
          onUsage: (usage) => insertEvent("system", "usage", { kind: "usage", usage }),
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unexpected tutor error.";
        send({ type: "error", message });
        send({ type: "done" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
