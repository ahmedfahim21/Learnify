import { asc, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { sessionEvents, sessions, topics } from "@/db/schema";
import { runTurn, type TurnFrame } from "@/lib/agent/loop";
import {
  buildMessages,
  EventKind,
  type EventPayload,
  type StoredEvent,
} from "@/lib/agent/transcript";
import {
  FORCED_RECAP_DIRECTIVE,
  MAX_LEARNER_TURNS,
  renderLearnerSnapshot,
} from "@/lib/agent/prompts";
import {
  collectComponents,
  gradeAction,
  type LearnerAction,
} from "@/lib/agent/grading";

export const runtime = "nodejs";
export const maxDuration = 300;

interface TurnRequestBody {
  /** A new free-text learner message for this turn (resumed sessions). */
  message?: string;
  /** A structured widget interaction, graded deterministically server-side. */
  action?: LearnerAction;
  /** Optional topic title to seed a brand-new session. */
  topicTitle?: string;
  /** Optional learner notes (how they learn). */
  learnerNotes?: string;
}

/** Read a numeric token-usage field defensively. */
function usageField(usage: unknown, key: string): number {
  const value = (usage as Record<string, unknown> | undefined)?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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
    .select({ id: sessions.id, topicId: sessions.topicId, plan: sessions.plan })
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
  // Once the learner has taken enough turns, force a wrap-up.
  const learnerTurns = stored.filter(
    (e) => e.payload.kind === EventKind.UserMessage,
  ).length;
  const forceRecap = hasHistory && learnerTurns >= MAX_LEARNER_TURNS;

  if (!hasHistory) {
    // A session started against selected concepts carries them in its plan; seed
    // them as the snapshot's focus so the tutor teaches them in order (#42).
    const planFocus = (session.plan as { focus?: unknown } | null)?.focus;
    const focusConcepts = Array.isArray(planFocus)
      ? planFocus.filter((f): f is string => typeof f === "string")
      : undefined;
    const text = renderLearnerSnapshot({
      topicTitle,
      learnerNotes: body.learnerNotes,
      focusConcepts,
    });
    const payload: EventPayload = { kind: EventKind.UserMessage, text };
    await insertEvent("user", payload.kind, payload);
    stored.push({ seq: nextSeq - 1, role: "user", payload });
  } else if (body.action || body.message) {
    // A structured widget interaction is graded deterministically here; a plain
    // message passes through. The forced-recap directive is appended either way.
    let text: string;
    if (body.action) {
      text = gradeAction(body.action, collectComponents(stored)).message;
    } else {
      text = body.message ?? "";
    }
    if (forceRecap) text += FORCED_RECAP_DIRECTIVE;
    const payload: EventPayload = { kind: EventKind.UserMessage, text };
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

      // Accumulate this turn's token usage into the per-session ledger.
      let addInput = 0;
      let addOutput = 0;
      let addCacheRead = 0;

      try {
        await runTurn({
          messages,
          surfaceId,
          emit: send,
          persist: (role, payload) => insertEvent(role, payload.kind, payload),
          onUsage: (usage) => {
            addInput += usageField(usage, "input_tokens");
            addOutput += usageField(usage, "output_tokens");
            addCacheRead += usageField(usage, "cache_read_input_tokens");
            return insertEvent("system", "usage", { kind: "usage", usage });
          },
          onPlan: async (plan) => {
            await db
              .update(sessions)
              .set({ plan: plan as object })
              .where(eq(sessions.id, sessionId));
          },
          onEvidence: (evidence) =>
            insertEvent("system", "evidence", { kind: "evidence", evidence }),
        });

        // Persist the turn's token totals (cache_read_input_tokens > 0 on
        // multi-turn sessions is the caching-discipline assertion from #41).
        if (addInput || addOutput || addCacheRead) {
          await db
            .update(sessions)
            .set({
              inputTokens: sql`${sessions.inputTokens} + ${addInput}`,
              outputTokens: sql`${sessions.outputTokens} + ${addOutput}`,
              cacheReadTokens: sql`${sessions.cacheReadTokens} + ${addCacheRead}`,
            })
            .where(eq(sessions.id, sessionId));
        }
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
