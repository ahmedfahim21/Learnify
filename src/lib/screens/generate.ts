import { createParser, type ElementNode } from "@openuidev/lang-core";
import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { type GeneratedScreen, generatedScreens } from "@/db/schema";
import { refundDoubt } from "@/lib/budget";
import { stripFences } from "@/lib/doubts/answer";
import { LANGUAGES, type Lang } from "@/lib/languages";
import { screenCore } from "@/lib/openui/screenSpec";
import { chatStream } from "@/lib/sarvam/client";
import { translateProgram } from "@/lib/sarvam/translateText";
import type { Segment } from "@/lib/transcripts/merge";
import { dbDeps as transcriptDeps } from "@/lib/transcripts/store";

import { type ScreenKind, screenMessages, type ScreenVariant } from "./prompt";
import { type KeyReport, verifyQuiz } from "./verifyKeys";

/**
 * Generate a study screen as a stream, then store it for everyone.
 *
 * Events are newline-delimited JSON, like doubts:
 *   {"type":"delta","text":"…"}   OpenUI Lang as it arrives
 *   {"type":"done","screenId":"…"} checked and stored
 *   {"type":"error","message":"…"} not stored; the student's unit refunded
 *
 * For a language sarvam-105b can't write (see `writes` in lib/languages) the
 * screen is written in English and its text translated before it's stored;
 * the English never reaches the student. Those streams carry no deltas:
 *   {"type":"status","text":"…"}   what's happening, for the waiting screen
 *   {"type":"program","text":"…"}  the whole translated screen, once
 *
 * A quiz's answer keys are checked before it's stored (see verifyKeys): a
 * "status" while that runs, then a "program" if anything was corrected.
 */

export const SCREEN_MODEL = "sarvam-105b-conversations";

export type ScreenEvent =
  | { type: "delta"; text: string }
  | { type: "status"; text: string }
  | { type: "program"; text: string }
  | { type: "done"; screenId: string }
  | { type: "error"; message: string };

export interface ScreenInput {
  userId: string;
  lectureId: string;
  lang: Lang;
  kind: ScreenKind;
  variant: ScreenVariant;
}

// --- Checking a generated screen ---------------------------------------------

export interface ScreenCheck {
  ok: boolean;
  /** Problems that make the screen unusable. */
  fatal: string[];
  /** Components the renderer will drop or a question with a broken key. Tolerated in small numbers. */
  dropped: string[];
}

function isElement(v: unknown): v is ElementNode {
  return typeof v === "object" && v !== null && (v as { type?: unknown }).type === "element";
}

/** A question whose answer key can't be right: shown wrong, it would teach the wrong thing. */
function badKey(node: ElementNode): string | null {
  const p = node.props as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? (v as unknown[]) : []);
  switch (node.typeName) {
    case "Mcq": {
      const options = arr(p.options);
      const distinct = new Set(options.map((o) => String(o).trim().toLowerCase())).size === options.length;
      const i = Number(p.answerIndex);
      if (options.length < 2 || !distinct) return "Mcq needs 2+ distinct options";
      if (!Number.isInteger(i) || i < 0 || i >= options.length) return `Mcq answerIndex ${p.answerIndex} out of range`;
      return null;
    }
    case "MatchPairs":
      return arr(p.left).length >= 2 && arr(p.left).length === arr(p.right).length ? null : "MatchPairs needs equal left/right lists of 2+";
    case "OrderSteps":
      return arr(p.steps).length >= 3 ? null : "OrderSteps needs 3+ steps";
    case "FillBlank":
      return String(p.prompt ?? "").includes("___") && String(p.answer ?? "").trim() ? null : "FillBlank needs ___ and an answer";
    default:
      return null;
  }
}

const NOTE_PARTS = new Set(["KeyIdea", "Paragraph", "Example", "Reveal", "Steps", "Formula", "TimeChip", "Callout"]);

/**
 * Attach note parts the model defined but forgot to reference. It writes
 * statements in order, so an orphaned Reveal right after a Section's other
 * parts belongs to that Section; without this it is silently dropped, and
 * Reveals are the interactive part of the notes.
 */
export function attachOrphans(program: string): { program: string; attached: string[] } {
  const orphaned = createParser(screenCore.toJSONSchema()).parse(program).meta.orphaned;
  if (orphaned.length === 0) return { program, attached: [] };
  const lines = program.split("\n");
  const attached: string[] = [];
  for (const name of orphaned) {
    const at = lines.findIndex((l) => l.startsWith(`${name} = `));
    const type = lines[at]?.slice(name.length + 3).match(/^(\w+)\(/)?.[1];
    if (at < 0 || !type || !NOTE_PARTS.has(type)) continue;
    let owner = -1;
    for (let i = at - 1; i >= 0; i--) {
      if (/^\w+ = Section\(/.test(lines[i])) {
        owner = i;
        break;
      }
    }
    if (owner < 0 || !lines[owner].trimEnd().endsWith("])")) continue;
    lines[owner] = lines[owner].trimEnd().replace(/\[(.*)\]\)$/, (_, inner: string) => `[${inner.trim() ? `${inner}, ` : ""}${name}])`);
    attached.push(name);
  }
  return { program: lines.join("\n"), attached };
}

/** At most this many dropped components before a screen is rejected outright. */
const MAX_DROPPED = 2;

export function checkScreen(program: string, kind: ScreenKind): ScreenCheck {
  const result = createParser(screenCore.toJSONSchema()).parse(program);
  const fatal: string[] = [];
  const dropped = result.meta.errors.map((e) => `${e.component ?? "?"}: ${e.message}`);
  if (!result.root || result.root.typeName !== "Screen") fatal.push(`root is ${result.root?.typeName ?? "missing"}, expected Screen`);
  if (result.meta.incomplete) fatal.push("output is incomplete");
  for (const ref of result.meta.unresolved) fatal.push(`undefined reference ${ref}`);

  let questions = 0;
  let sections = 0;
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!isElement(node)) return;
    if (["Mcq", "TrueFalse", "FillBlank", "MatchPairs", "OrderSteps"].includes(node.typeName)) {
      questions++;
      const bad = badKey(node);
      if (bad) dropped.push(bad);
    }
    if (node.typeName === "Section") sections++;
    for (const v of Object.values(node.props)) walk(v);
  };
  walk(result.root);
  if (kind === "quiz" && questions < 4) fatal.push(`quiz has ${questions} questions; expected 8 to 10`);
  if (kind === "notes" && sections < 2) fatal.push(`notes have ${sections} sections; expected 3 to 6`);
  if (dropped.length > MAX_DROPPED) fatal.push(`${dropped.length} broken components`);
  return { ok: fatal.length === 0, fatal, dropped };
}

// --- Storage and generation ---------------------------------------------------

export interface ScreenDeps {
  lecture: (lectureId: string) => Promise<{ title: string; english: Segment[] } | null>;
  stream: (messages: ReturnType<typeof screenMessages>, tag: string) => AsyncIterable<string>;
  save: (row: Omit<GeneratedScreen, "id" | "createdAt">) => Promise<string>;
  refund: (userId: string) => Promise<void>;
  translate: (program: string, lang: Lang, tag: string) => Promise<string>;
  /** A quiz's answer keys checked against the lecture; wrong ones fixed, unsure ones dropped. */
  verify: (program: string, transcript: string, tag: string) => Promise<{ program: string; report: KeyReport }>;
}

export const liveScreenDeps: ScreenDeps = {
  lecture: async (lectureId) => {
    const [lecture, english] = await Promise.all([
      transcriptDeps.getLecture(lectureId),
      transcriptDeps.getStored(lectureId, "en"),
    ]);
    return lecture && english ? { title: lecture.title, english: english.segments } : null;
  },
  stream: (messages, tag) => chatStream({ messages, model: SCREEN_MODEL, maxTokens: 8192 }, { tag }),
  save: async (row) => {
    const [saved] = await getDb()
      .insert(generatedScreens)
      .values(row)
      .onConflictDoUpdate({
        target: [generatedScreens.lectureId, generatedScreens.lang, generatedScreens.kind, generatedScreens.variant],
        set: { program: row.program, model: row.model, createdAt: sql`now()` },
      })
      .returning({ id: generatedScreens.id });
    return saved.id;
  },
  refund: refundDoubt,
  translate: (program, lang, tag) => translateProgram(program, lang, undefined, tag),
  verify: (program, transcript, tag) => verifyQuiz(program, transcript, undefined, `${tag} keys`),
};

export async function getScreen(lectureId: string, lang: Lang, kind: ScreenKind, variant: ScreenVariant) {
  const [row] = await getDb()
    .select()
    .from(generatedScreens)
    .where(
      and(
        eq(generatedScreens.lectureId, lectureId),
        eq(generatedScreens.lang, lang),
        eq(generatedScreens.kind, kind),
        eq(generatedScreens.variant, variant),
      ),
    );
  return row ?? null;
}

export class ScreenNotReadyError extends Error {
  constructor() {
    super("This lecture's transcript isn't ready yet, so there's nothing to build study screens from.");
    this.name = "ScreenNotReadyError";
  }
}

/** Everything needed before charging the student: the lecture and its English transcript. */
export async function prepareScreen(input: Omit<ScreenInput, "userId">, deps: ScreenDeps = liveScreenDeps) {
  const lecture = await deps.lecture(input.lectureId);
  if (!lecture) throw new ScreenNotReadyError();
  // Written in English when the model can't write the student's language; translated after.
  const writing = LANGUAGES[input.lang].writes ? input.lang : "en";
  return screenMessages({ ...input, lang: writing, title: lecture.title, english: lecture.english }, screenCore);
}

export async function* generateScreen(
  input: ScreenInput,
  messages: ReturnType<typeof screenMessages>,
  deps: ScreenDeps = liveScreenDeps,
): AsyncGenerator<ScreenEvent> {
  const tag = `screen ${input.lectureId}/${input.lang}/${input.kind}/${input.variant}`;
  const direct = LANGUAGES[input.lang].writes;
  let text = "";
  let failure: string | null = null;
  if (!direct) yield { type: "status", text: "Writing from the lecture" };
  try {
    for await (const delta of deps.stream(messages, tag)) {
      text += delta;
      if (direct) yield { type: "delta", text: delta };
    }
  } catch (err) {
    failure = err instanceof Error ? err.message : String(err);
  }

  const repaired = attachOrphans(stripFences(text));
  let program = repaired.program;
  if (repaired.attached.length) console.info(`${tag}: attached orphaned ${repaired.attached.join(", ")}`);
  if (!failure) {
    const check = checkScreen(program, input.kind);
    if (check.dropped.length) console.warn(`${tag}: ${check.dropped.join("; ")}`);
    if (!check.ok) failure = `The screen came back malformed (${check.fatal.slice(0, 3).join("; ")}).`;
  }
  if (!failure && input.kind === "quiz") {
    yield { type: "status", text: "Checking the answers" };
    try {
      // The transcript the quiz was written from is the user message.
      const transcript = messages.find((m) => m.role === "user")?.content ?? "";
      const checked = await deps.verify(program, transcript, tag);
      const { fixed, dropped } = checked.report;
      if (fixed.length || dropped.length) console.info(`${tag}: keys fixed ${fixed.join(", ") || "none"}; dropped ${dropped.join(", ") || "none"}`);
      program = checked.program;
      const again = checkScreen(program, input.kind);
      if (!again.ok) failure = `Too few questions held up when their answers were checked (${again.fatal.slice(0, 2).join("; ")}).`;
      else if (direct && (fixed.length || dropped.length)) yield { type: "program", text: program };
    } catch (err) {
      failure = `Checking the answers failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  if (!failure && !direct) {
    yield { type: "status", text: `Translating into ${LANGUAGES[input.lang].name}` };
    try {
      program = await deps.translate(program, input.lang, tag);
      // Translation only touches string contents, but check the result is still a whole screen.
      const again = checkScreen(program, input.kind);
      if (!again.ok) failure = `The translated screen came back malformed (${again.fatal.slice(0, 3).join("; ")}).`;
    } catch (err) {
      failure = `Translating into ${LANGUAGES[input.lang].name} failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  if (failure) {
    console.error(`${tag} failed: ${failure}`);
    await deps.refund(input.userId);
    yield { type: "error", message: failure };
    return;
  }
  const screenId = await deps.save({
    lectureId: input.lectureId,
    lang: input.lang,
    kind: input.kind,
    variant: input.variant,
    program,
    model: direct ? SCREEN_MODEL : `${SCREEN_MODEL}+sarvam-translate:v1`,
  });
  if (!direct) yield { type: "program", text: program };
  yield { type: "done", screenId };
}
