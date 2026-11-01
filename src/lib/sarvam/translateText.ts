import { LANGUAGES, type Lang } from "@/lib/languages";

import { translate } from "./client";

/**
 * Translation into the languages sarvam-105b can't write directly (see
 * `writes` in lib/languages): the model writes in English, and Sarvam-Translate
 * turns the student-facing text into the target language.
 *
 * Maths is masked as ⟦n⟧ before translating and put back after, so LaTeX is
 * never rewritten (Sarvam-Translate keeps the placeholders). Strings with no
 * words outside the maths are left as they are.
 */

export type TextTranslator = (text: string, lang: Lang, tag?: string) => Promise<string>;

const MATH = /\$\$[^$]+\$\$|\$[^$\n]+\$|\\\(.+?\\\)/g;

export function maskMath(text: string): { masked: string; maths: string[] } {
  const maths: string[] = [];
  const masked = text.replace(MATH, (m) => `⟦${maths.push(m) - 1}⟧`);
  return { masked, maths };
}

export function unmaskMath(text: string, maths: string[]): string {
  return text.replace(/⟦(\d+)⟧/g, (whole, n: string) => maths[Number(n)] ?? whole);
}

/** True when a string has words to translate once its maths is set aside. */
export function hasWords(text: string): boolean {
  return /\p{L}{2,}/u.test(maskMath(text).masked.replace(/⟦\d+⟧/g, ""));
}

export const sarvamTranslate: TextTranslator = (text, lang, tag) =>
  translate(
    { input: text, source: "en-IN", target: LANGUAGES[lang].sarvam, model: "sarvam-translate:v1", mode: "formal" },
    { tag },
  );

/** The other direction, for a student's question asked in one of those languages. */
export const sarvamTranslateToEnglish: TextTranslator = (text, lang, tag) =>
  translate(
    { input: text, source: LANGUAGES[lang].sarvam, target: "en-IN", model: "sarvam-translate:v1", mode: "formal" },
    { tag },
  );

/**
 * Translate many strings, each distinct one once, maths kept intact. Throws if
 * a translation drops a maths placeholder, rather than showing a formula-less
 * sentence.
 */
export async function translateTexts(
  texts: string[],
  lang: Lang,
  translator: TextTranslator = sarvamTranslate,
  tag?: string,
): Promise<string[]> {
  const unique = [...new Set(texts.filter(hasWords))];
  const done = new Map<string, string>();
  await Promise.all(
    unique.map(async (text) => {
      const { masked, maths } = maskMath(text);
      const out = (await translator(masked, lang, tag)).trim();
      const kept = new Set([...out.matchAll(/⟦(\d+)⟧/g)].map((m) => Number(m[1])));
      if (maths.some((_, i) => !kept.has(i))) throw new Error(`translation into ${lang} dropped maths from: ${text.slice(0, 80)}`);
      done.set(text, unmaskMath(out, maths));
    }),
  );
  return texts.map((t) => done.get(t) ?? t);
}

// --- OpenUI programs -----------------------------------------------------------

/** String literals in one statement, as raw (still-escaped) source text. */
const LITERAL = /"((?:[^"\\]|\\.)*)"/g;

/** Arguments that are code, not prose: a Formula's expression. */
const SKIP: Record<string, number[]> = { Formula: [0] };

/** Escape translated prose back into a string literal (maths was already raw source). */
function escapeLiteral(text: string): string {
  return text.replace(/\\(?![a-zA-Z{}()[\]_^$,;!| ])/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/**
 * Translate every piece of student-facing text in an OpenUI Lang program,
 * leaving its structure alone: statement names, component names, numbers,
 * booleans, references, timestamps and answer indexes are untouched, so the
 * translated screen grades and seeks exactly like the English one.
 */
export async function translateProgram(
  program: string,
  lang: Lang,
  translator: TextTranslator = sarvamTranslate,
  tag?: string,
): Promise<string> {
  const lines = program.split("\n");
  const slots: { line: number; start: number; end: number; text: string }[] = [];
  lines.forEach((line, n) => {
    const component = /^\w+\s*=\s*(\w+)\(/.exec(line)?.[1] ?? "";
    let k = 0;
    for (const m of line.matchAll(LITERAL)) {
      const skip = SKIP[component]?.includes(k++);
      if (skip || !hasWords(m[1])) continue;
      slots.push({ line: n, start: m.index! + 1, end: m.index! + 1 + m[1].length, text: m[1] });
    }
  });
  if (slots.length === 0) return program;

  // Translate the prose with escapes undone, then escape it again on the way back in.
  const plain = slots.map((s) => s.text.replace(/\\"/g, '"').replace(/\\n/g, "\n"));
  const translated = await translateTexts(plain, lang, translator, tag);

  // Replace from the end of each line backwards so earlier offsets stay valid.
  for (let i = slots.length - 1; i >= 0; i--) {
    const s = slots[i];
    const { masked, maths } = maskMath(translated[i]);
    const literal = unmaskMath(escapeLiteral(masked), maths);
    lines[s.line] = lines[s.line].slice(0, s.start) + literal + lines[s.line].slice(s.end);
  }
  return lines.join("\n");
}
