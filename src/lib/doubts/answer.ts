import { randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { type Doubt, doubts, type NewDoubt } from "@/db/schema";
import { refundDoubt } from "@/lib/budget";
import { LANGUAGES, type Lang, scriptShare } from "@/lib/languages";
import { doubtCore } from "@/lib/openui/doubtSpec";
import { checkOpenUi } from "@/lib/openui/validate";
import { type ChatMessage, chatStream } from "@/lib/sarvam/client";
import { sarvamTranslateToEnglish, translateProgram } from "@/lib/sarvam/translateText";
import { dbPackDeps } from "@/lib/study/store";
import type { Segment } from "@/lib/transcripts/merge";
import { dbDeps as transcriptDeps } from "@/lib/transcripts/store";

import { keyTerms } from "./keyterms";
import { doubtMessages, rewriteInScript } from "./prompt";

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
  /** For a language the model can't write: what's happening, then the whole translated answer. */
  | { type: "status"; text: string }
  | { type: "program"; text: string }
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
  stream: (messages: ChatMessage[], tag: string) => AsyncIterable<string>;
  save: (row: NewDoubt) => Promise<void>;
  refund: (userId: string) => Promise<void>;
  /** For languages sarvam-105b can't write: the question into English, the answer back out. */
  toEnglish: (text: string, lang: Lang) => Promise<string>;
  translate: (program: string, lang: Lang, tag: string) => Promise<string>;
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
  toEnglish: (text, lang) => sarvamTranslateToEnglish(text, lang, "doubt question"),
  translate: (program, lang, tag) => translateProgram(program, lang, undefined, tag),
};

/**
 * Below this share of letters in the student's script, an answer is taken to
 * be romanised rather than code-mixed. Code-mixed answers keep English terms
 * and still measured 0.3 and up on their prose; a romanised one is 0.
 */
export const MIN_SCRIPT_SHARE = 0.1;

/** The prose a student reads in an answer: its string literals, without Formula expressions or maths. */
export function answerProse(program: string): string {
  return program
    .split("\n")
    .map((line) => {
      const literals = [...line.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
      return (/^\w+\s*=\s*Formula\(/.test(line) ? literals.slice(1) : literals).join(" ");
    })
    .join(" ")
    .replace(/\$\$[^$]+\$\$|\$[^$\n]+\$/g, " ");
}

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
  // The model answers in English when it can't write the student's language; the answer is translated after.
  const direct = LANGUAGES[input.lang].writes;
  const question = direct ? input.question : await deps.toEnglish(input.question, input.lang);
  return doubtMessages(
    { lectureTitle: title, lang: direct ? input.lang : "en", atSec: input.atSec, question, english, concepts },
    doubtCore,
  );
}

/** Terms to bias speech recognition toward for a doubt about this lecture at `atSec`; null for an unknown lecture. */
export async function lectureKeyTerms(lectureId: string, atSec: number, deps: AnswerDeps = liveAnswerDeps): Promise<string[] | null> {
  const [title, english, concepts] = await Promise.all([
    deps.lectureTitle(lectureId),
    deps.englishSegments(lectureId),
    deps.concepts(lectureId, "en"),
  ]);
  if (!title) return null;
  return keyTerms({ lectureTitle: title, concepts: concepts.map((c) => c.title), english, atSec });
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
  const direct = LANGUAGES[input.lang].writes;
  let text = "";
  let failure: string | null = null;
  if (!direct) yield { type: "status", text: "Working out the answer" };

  try {
    for await (const delta of deps.stream(messages, `doubt ${id}`)) {
      text += delta;
      if (direct) yield { type: "delta", text: delta };
    }
    const check = checkOpenUi(stripFences(text), doubtCore);
    if (!check.ok) failure = `The answer came back malformed (${check.problems.slice(0, 3).join("; ")}).`;
  } catch (err) {
    failure = err instanceof Error ? err.message : String(err);
  }

  let answer = stripFences(text);

  // An answer in the wrong script (romanised Hindi instead of Devanagari) gets one rewrite.
  if (!failure && direct && input.lang !== "en" && scriptShare(answerProse(answer), input.lang) < MIN_SCRIPT_SHARE) {
    const { name, native } = LANGUAGES[input.lang];
    console.warn(`doubt ${id}: answer was ${Math.round(scriptShare(answerProse(answer), input.lang) * 100)}% ${name} script; asking for a rewrite`);
    yield { type: "status", text: `Rewriting it in ${native} script` };
    let again = "";
    try {
      const followUp: ChatMessage[] = [...messages, { role: "assistant", content: text }, { role: "user", content: rewriteInScript(input.lang) }];
      for await (const delta of deps.stream(followUp, `doubt ${id} rewrite`)) again += delta;
      const rewritten = stripFences(again);
      const check = checkOpenUi(rewritten, doubtCore);
      if (!check.ok) failure = `The rewritten answer came back malformed (${check.problems.slice(0, 3).join("; ")}).`;
      else if (scriptShare(answerProse(rewritten), input.lang) < MIN_SCRIPT_SHARE) failure = `The answer didn't come back in ${name} script.`;
      else {
        answer = rewritten;
        yield { type: "program", text: answer };
      }
    } catch (err) {
      failure = err instanceof Error ? err.message : String(err);
    }
  }

  if (!failure && !direct) {
    yield { type: "status", text: `Translating into ${LANGUAGES[input.lang].name}` };
    try {
      answer = await deps.translate(answer, input.lang, `doubt ${id}`);
    } catch (err) {
      failure = `Translating into ${LANGUAGES[input.lang].name} failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  if (failure) {
    console.error(`doubt ${id} failed: ${failure}`);
    await deps.save({ ...base, status: "failed", answer: null, error: failure });
    await deps.refund(input.userId);
    yield { type: "error", doubtId: id, message: failure };
    return;
  }
  await deps.save({ ...base, model: direct ? DOUBT_MODEL : `${DOUBT_MODEL}+sarvam-translate:v1`, status: "answered", answer, error: null });
  if (!direct) yield { type: "program", text: answer };
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
