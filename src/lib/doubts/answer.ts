import { randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { type Doubt, doubts, type NewDoubt } from "@/db/schema";
import { refundDoubt } from "@/lib/budget";
import type { Lang } from "@/lib/languages";
import { doubtCore } from "@/lib/openui/doubtSpec";
import { checkOpenUi } from "@/lib/openui/validate";
import { chatStream } from "@/lib/sarvam/client";
import { dbPackDeps } from "@/lib/study/store";
import type { Segment } from "@/lib/transcripts/merge";
import { dbDeps as transcriptDeps } from "@/lib/transcripts/store";

import { doubtMessages } from "./prompt";

/**
 * Answer a doubt as a stream of events, then store it.
 *
 * Events are newline-delimited JSON so the client always learns how a doubt
 * ended, not just that the stream closed:
 *   {"type":"delta","text":"…"}            OpenUI Lang as it arrives
 *   {"type":"done","doubtId":"…"}          validated and stored
 *   {"type":"error","doubtId":"…","message":"…"}   stored as failed, unit refunded
 */

export const DOUBT_MODEL = "sarvam-105b-conversations";

export type DoubtEvent =
  | { type: "delta"; text: string }
  | { type: "done"; doubtId: string }
  | { type: "error"; doubtId: string; message: string };

export interface AskInput {
  userId: string;
  lectureId: string;
  lang: Lang;
  atSec: number;
  question: string;
}

export interface AnswerDeps {
  lectureTitle: (lectureId: string) => Promise<string | null>;
  englishSegments: (lectureId: string) => Promise<Segment[] | null>;
  concepts: (lectureId: string, lang: Lang) => Promise<{ title: string; startSec: number }[]>;
  stream: (messages: ReturnType<typeof doubtMessages>, tag: string) => AsyncIterable<string>;
  save: (row: NewDoubt) => Promise<void>;
  refund: (userId: string) => Promise<void>;
}

export const liveAnswerDeps: AnswerDeps = {
  lectureTitle: async (id) => (await transcriptDeps.getLecture(id))?.title ?? null,
  englishSegments: async (id) => (await transcriptDeps.getStored(id, "en"))?.segments ?? null,
  concepts: async (id, lang) => {
    const pack = (await dbPackDeps.getStored(id, lang)) ?? (await dbPackDeps.getStored(id, "en"));
    return pack?.payload.concepts.map((c) => ({ title: c.title, startSec: c.startSec })) ?? [];
  },
  stream: (messages, tag) => chatStream({ messages, model: DOUBT_MODEL, maxTokens: 2048 }, { tag }),
  save: async (row) => {
    await getDb().insert(doubts).values(row);
  },
  refund: refundDoubt,
};

export class NotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotReadyError";
  }
}

/** Models sometimes wrap code in markdown fences despite the prompt; the program inside is what counts. */
export function stripFences(text: string): string {
  const fenced = text.trim().match(/^```[\w-]*\n([\s\S]*?)\n?```$/);
  return (fenced ? fenced[1] : text).trim();
}

/**
 * Check what's needed before charging the student: the lecture and its English
 * transcript (answers are grounded in it). Throws NotReadyError otherwise.
 */
export async function prepareDoubt(input: AskInput, deps: AnswerDeps = liveAnswerDeps) {
  const [title, english, concepts] = await Promise.all([
    deps.lectureTitle(input.lectureId),
    deps.englishSegments(input.lectureId),
    deps.concepts(input.lectureId, input.lang),
  ]);
  if (!title) throw new NotReadyError("No such lecture.");
  if (!english) throw new NotReadyError("This lecture's transcript isn't ready yet, so doubts can't be grounded in it.");
  return doubtMessages(
    { lectureTitle: title, lang: input.lang, atSec: input.atSec, question: input.question, english, concepts },
    doubtCore,
  );
}

export async function* answerDoubt(
  input: AskInput,
  messages: ReturnType<typeof doubtMessages>,
  deps: AnswerDeps = liveAnswerDeps,
): AsyncGenerator<DoubtEvent> {
  const id = randomUUID();
  const base = {
    id,
    userId: input.userId,
    lectureId: input.lectureId,
    lang: input.lang,
    atSec: input.atSec,
    question: input.question,
    model: DOUBT_MODEL,
  };
  let text = "";
  let failure: string | null = null;

  try {
    for await (const delta of deps.stream(messages, `doubt ${id}`)) {
      text += delta;
      yield { type: "delta", text: delta };
    }
    const check = checkOpenUi(stripFences(text), doubtCore);
    if (!check.ok) failure = `The answer came back malformed (${check.problems.slice(0, 3).join("; ")}).`;
  } catch (err) {
    failure = err instanceof Error ? err.message : String(err);
  }

  if (failure) {
    console.error(`doubt ${id} failed: ${failure}`);
    await deps.save({ ...base, status: "failed", answer: null, error: failure });
    await deps.refund(input.userId);
    yield { type: "error", doubtId: id, message: failure };
    return;
  }
  await deps.save({ ...base, status: "answered", answer: stripFences(text), error: null });
  yield { type: "done", doubtId: id };
}

// --- Reading back ------------------------------------------------------------

export async function getOwnDoubt(userId: string, doubtId: string): Promise<Doubt | null> {
  const [row] = await getDb()
    .select()
    .from(doubts)
    .where(and(eq(doubts.id, doubtId), eq(doubts.userId, userId)));
  return row ?? null;
}

export async function listOwnDoubts(userId: string, lectureId: string): Promise<Doubt[]> {
  return getDb()
    .select()
    .from(doubts)
    .where(and(eq(doubts.userId, userId), eq(doubts.lectureId, lectureId), eq(doubts.status, "answered")))
    .orderBy(desc(doubts.createdAt))
    .limit(50);
}
