import { LANGUAGES, type Lang } from "@/lib/languages";
import type { Segment } from "@/lib/transcripts/merge";

import { chatJson, translate } from "./client";

/**
 * Translate a lecture's English segments into one target language, keeping
 * each segment's timestamps.
 *
 * Two translators sit behind one interface (the spike A/B'd them; Mayura won):
 * - `sarvam105b`: batches of segments in one structured-output call to
 *   sarvam-105b-conversations (sub-second; the reasoning model took ~20 s
 *   for two sentences). The
 *   model only ever sees `{i, text}`; timestamps are reattached from the
 *   English segments by `i`, so they never pass through the model.
 * - `mayura`: Sarvam's dedicated translate endpoint in `code-mixed` mode, one
 *   call per segment.
 */

export type TranslatorName = "sarvam105b" | "mayura";

export class AlignmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AlignmentError";
  }
}

export interface TranslatedItem {
  i: number;
  text: string;
}

/**
 * Check a model's batch reply against what was sent: the same ids, once each,
 * non-empty, and actually translated. Code-mixed output legitimately keeps
 * English terms, so "untranslated" means a real sentence (5+ words) came back
 * with no character of the target script at all.
 */
export function alignBatch(sent: Segment[], got: TranslatedItem[], lang: Lang): Map<number, string> {
  const expected = new Map(sent.map((s) => [s.i, s.text]));
  const script = LANGUAGES[lang].script;
  const out = new Map<number, string>();
  for (const item of got) {
    if (!expected.has(item.i)) throw new AlignmentError(`unexpected id ${item.i}`);
    if (out.has(item.i)) throw new AlignmentError(`duplicate id ${item.i}`);
    const text = item.text.trim();
    if (!text) throw new AlignmentError(`empty translation for id ${item.i}`);
    const words = expected.get(item.i)!.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
    if (words >= 5 && !script.test(text)) {
      throw new AlignmentError(`id ${item.i} came back untranslated: ${text.slice(0, 80)}`);
    }
    out.set(item.i, text);
  }
  const missing = sent.filter((s) => !out.has(s.i)).map((s) => s.i);
  if (missing.length) throw new AlignmentError(`missing ids ${missing.join(", ")}`);
  return out;
}

const batchSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { i: { type: "integer" }, text: { type: "string" } },
        required: ["i", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

function systemPrompt(lang: Lang, glossary: string[]): string {
  const { name } = LANGUAGES[lang];
  return [
    `You translate subtitles of an IIT engineering lecture from English into ${name}.`,
    `Write the way an Indian engineering student speaks ${name}: natural ${name} grammar, but every technical or English-origin term stays in English, written in Latin script — never transliterated into ${name} script.`,
    `Example: "Computer Science Engineering Department" stays "Computer Science Engineering Department", not a ${name}-script spelling of it. The same goes for course, program, variable names, code, numbers and formulas.`,
    "Translate every item. Keep each item's `i` exactly. Do not merge, split, drop or reorder items. Do not add explanations.",
    glossary.length
      ? `Keep these lecture terms in English, spelled exactly: ${glossary.join(", ")}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function translateBatch105b(batch: Segment[], lang: Lang, glossary: string[], tag?: string) {
  const { value } = await chatJson<{ items: TranslatedItem[] }>({
    messages: [
      { role: "system", content: systemPrompt(lang, glossary) },
      { role: "user", content: JSON.stringify({ items: batch.map(({ i, text }) => ({ i, text })) }) },
    ],
    model: "sarvam-105b-conversations",
    jsonSchema: { name: "subtitle_batch", schema: batchSchema },
    maxTokens: 8192,
  }, { tag });
  return alignBatch(batch, value.items, lang);
}

/** On misalignment, retry by halves down to single segments; a single segment that still fails throws. */
async function translateWithSplit(
  batch: Segment[],
  lang: Lang,
  glossary: string[],
  tag?: string,
): Promise<Map<number, string>> {
  try {
    return await translateBatch105b(batch, lang, glossary, tag);
  } catch (err) {
    if (!(err instanceof AlignmentError) || batch.length === 1) throw err;
    const mid = Math.ceil(batch.length / 2);
    const [a, b] = await Promise.all([
      translateWithSplit(batch.slice(0, mid), lang, glossary, tag),
      translateWithSplit(batch.slice(mid), lang, glossary, tag),
    ]);
    return new Map([...a, ...b]);
  }
}

const MAYURA_MAX_CHARS = 1000;
const MAYURA_CONCURRENCY = 4;

/** Split text at word boundaries into pieces no longer than `max` characters. */
export function splitForLimit(text: string, max: number): string[] {
  const pieces: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (word.length > max) throw new Error(`a single word is longer than ${max} characters`);
    if (current && current.length + 1 + word.length > max) {
      pieces.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

export interface TranslateOptions {
  /** Defaults to Mayura, which the spike chose (PLAN.md section 6). */
  translator?: TranslatorName;
  glossary?: string[];
  batchSize?: number;
  /** Segments translated by an earlier, interrupted run: kept, never re-sent. */
  already?: ReadonlyMap<number, string>;
  /**
   * Called with each newly translated group (one segment for Mayura, one batch
   * for 105b) before moving on, so a job can save progress and resume from it.
   * A rejection stops the translation.
   */
  onTranslated?: (items: TranslatedItem[]) => void | Promise<void>;
  /** Log tag for the Sarvam calls, e.g. "lecture 325080ef/hi". */
  tag?: string;
}

export async function translateSegments(
  segments: Segment[],
  lang: Lang,
  { translator = "mayura", glossary = [], batchSize = 40, already, onTranslated, tag }: TranslateOptions = {},
): Promise<Segment[]> {
  const translated = new Map<number, string>();
  for (const s of segments) {
    const prior = already?.get(s.i);
    if (prior) translated.set(s.i, prior);
  }
  const todo = segments.filter((s) => !translated.has(s.i));

  if (translator === "mayura") {
    const target = LANGUAGES[lang].sarvam;
    let next = 0;
    const worker = async () => {
      while (next < todo.length) {
        const s = todo[next++];
        const parts: string[] = [];
        for (const piece of splitForLimit(s.text, MAYURA_MAX_CHARS)) {
          parts.push(await translate({ input: piece, source: "en-IN", target }, { tag }));
        }
        const text = parts.join(" ");
        translated.set(s.i, text);
        await onTranslated?.([{ i: s.i, text }]);
      }
    };
    await Promise.all(Array.from({ length: MAYURA_CONCURRENCY }, worker));
  } else {
    for (let start = 0; start < todo.length; start += batchSize) {
      const batch = todo.slice(start, start + batchSize);
      const items: TranslatedItem[] = [];
      for (const [i, text] of await translateWithSplit(batch, lang, glossary, tag)) {
        translated.set(i, text);
        items.push({ i, text });
      }
      await onTranslated?.(items);
    }
  }

  return segments.map((s) => ({ ...s, text: translated.get(s.i)! }));
}
