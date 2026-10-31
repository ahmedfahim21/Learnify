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

/**
 * - `hybrid` (default): batches through sarvam-105b-conversations, then Mayura
 *   for just the segments a batch got wrong. ~40× fewer requests than Mayura
 *   alone, which matters: one request per segment hit Sarvam's rate limit on
 *   real lectures.
 * - `mayura`: one /translate call per segment.
 * - `sarvam105b`: batches only, failing loudly on a bad batch.
 */
export type TranslatorName = "hybrid" | "sarvam105b" | "mayura";

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
    `You translate subtitles of an NPTEL lecture from English into ${name}.`,
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

async function requestBatch(batch: Segment[], lang: Lang, glossary: string[], tag?: string) {
  const { value } = await chatJson<{ items: TranslatedItem[] }>({
    messages: [
      { role: "system", content: systemPrompt(lang, glossary) },
      { role: "user", content: JSON.stringify({ items: batch.map(({ i, text }) => ({ i, text })) }) },
    ],
    model: "sarvam-105b-conversations",
    jsonSchema: { name: "subtitle_batch", schema: batchSchema },
    maxTokens: 8192,
  }, { tag });
  return value.items;
}

async function translateBatch105b(batch: Segment[], lang: Lang, glossary: string[], tag?: string) {
  return alignBatch(batch, await requestBatch(batch, lang, glossary, tag), lang);
}

/**
 * Keep every item of a batch reply that passes the same checks alignBatch
 * applies, and return the segments that didn't (missing, duplicated, empty or
 * left in English) so they can go to Mayura one by one.
 */
export function partialAlign(sent: Segment[], got: TranslatedItem[], lang: Lang): { good: Map<number, string>; redo: Segment[] } {
  const good = new Map<number, string>();
  const seen = new Set<number>();
  const dupes = new Set<number>();
  for (const item of got) (seen.has(item.i) ? dupes : seen).add(item.i);
  for (const s of sent) {
    const items = got.filter((g) => g.i === s.i);
    if (items.length !== 1 || dupes.has(s.i)) continue;
    try {
      const [[, text]] = alignBatch([s], items, lang);
      good.set(s.i, text);
    } catch (err) {
      if (!(err instanceof AlignmentError)) throw err;
    }
  }
  return { good, redo: sent.filter((s) => !good.has(s.i)) };
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
  /** Defaults to hybrid (batched, Mayura for misses); see TranslatorName. */
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
  { translator = "hybrid", glossary = [], batchSize = 40, already, onTranslated, tag }: TranslateOptions = {},
): Promise<Segment[]> {
  const translated = new Map<number, string>();
  for (const s of segments) {
    const prior = already?.get(s.i);
    if (prior) translated.set(s.i, prior);
  }
  const todo = segments.filter((s) => !translated.has(s.i));

  const target = LANGUAGES[lang].sarvam;
  const viaMayura = async (list: Segment[]) => {
    let next = 0;
    const worker = async () => {
      while (next < list.length) {
        const s = list[next++];
        const parts: string[] = [];
        for (const piece of splitForLimit(s.text, MAYURA_MAX_CHARS)) {
          parts.push(await translate({ input: piece, source: "en-IN", target }, { tag }));
        }
        const text = parts.join(" ");
        translated.set(s.i, text);
        await onTranslated?.([{ i: s.i, text }]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(MAYURA_CONCURRENCY, list.length) }, worker));
  };

  if (translator === "mayura") {
    await viaMayura(todo);
  } else if (translator === "hybrid") {
    for (let start = 0; start < todo.length; start += batchSize) {
      const batch = todo.slice(start, start + batchSize);
      let good = new Map<number, string>();
      let redo = batch;
      try {
        ({ good, redo } = partialAlign(batch, await requestBatch(batch, lang, glossary, tag), lang));
      } catch (err) {
        // A batch that fails outright (truncated, malformed, Sarvam error) goes to Mayura whole.
        console.warn(`batch translation failed for ${tag ?? lang}; using Mayura for ${batch.length} segments:`, err instanceof Error ? err.message : err);
      }
      if (good.size) {
        for (const [i, text] of good) translated.set(i, text);
        await onTranslated?.([...good].map(([i, text]) => ({ i, text })));
      }
      if (redo.length) await viaMayura(redo);
    }
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
