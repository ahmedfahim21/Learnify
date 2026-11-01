import { LANGUAGES, type Lang } from "@/lib/languages";
import type { DoubtCore } from "@/lib/openui/doubtSpec";
import { segmentsBetween, type Segment } from "@/lib/transcripts/merge";

/**
 * Prompt for answering a student's doubt as an OpenUI Lang card, grounded in
 * what the lecturer said just before the moment they paused.
 */

export const DOUBT_WINDOW_BEFORE_SEC = 180;
export const DOUBT_WINDOW_AFTER_SEC = 20;

/** One worked answer, so the model sees positional syntax and the code-mixed register. */
const EXAMPLE = [
  'root = Answer("ஏன் n-ஆல் divide பண்றோம்?", [k1, p1, f1, t1, r1, c1])',
  'k1 = KeyIdea("Average-ன்னா மொத்தத்தை values-ஓட count-ஆல பிரிக்கிறது; அந்த count தான் n.")',
  'p1 = Paragraph("Average கண்டுபிடிக்க எல்லா values-ஐயும் add பண்ணி, மொத்தம் எத்தனை values இருக்கோ அந்த count-ஆல divide பண்றோம். இங்க count தான் n.")',
  'f1 = Formula("mean = (x1 + x2 + ... + xn) / n", "n = number of values")',
  't1 = TimeChip(312, "Average-ஐ define பண்ற இடம்")',
  'r1 = Reveal("5 values-ஓட sum 40-ன்னா average என்ன?", "40 / 5 = 8")',
  'c1 = Callout("note", "n-க்கு பதிலா n-1 use பண்றது sample variance-ல மட்டும் தான்.")',
].join("\n");

/** A comparison doubt, so the model sees a Compare table in use. */
const COMPARE_EXAMPLE = [
  'root = Answer("Stack और queue में फर्क", [k1, c1, t1])',
  'k1 = KeyIdea("Stack में last-in first-out होता है, queue में first-in first-out.")',
  'c1 = Compare(["", "Stack", "Queue"], [["Order", "Last in, first out", "First in, first out"], ["Add / remove", "दोनों top से", "पीछे add, आगे से remove"]])',
  't1 = TimeChip(420, "Stack और queue की तुलना")',
].join("\n");

export interface DoubtInput {
  lectureTitle: string;
  lang: Lang;
  atSec: number;
  question: string;
  english: Segment[];
  concepts: { title: string; startSec: number }[];
}

/**
 * Repeated last, after the transcript and the question: with the rule only in
 * the system prompt, the model answered Hindi doubts in romanised Hinglish.
 */
export function answerLanguageReminder(lang: Lang): string {
  if (lang === "en") return "Answer in English.";
  const { name, native } = LANGUAGES[lang];
  return `Answer in ${name} (${native}) written in ${name} script, not in Latin letters, even if the doubt was typed in Latin letters. Keep only technical terms, symbols and formulas in English.`;
}

/** The follow-up when an answer came back in the wrong script. */
export function rewriteInScript(lang: Lang): string {
  const { name, native } = LANGUAGES[lang];
  return `That answer is written in Latin letters. Write the same answer again, in ${name} script (${native}), as openui-lang only. Keep technical terms, symbols and formulas in English.`;
}

export function doubtMessages(input: DoubtInput, library: DoubtCore) {
  const { name } = LANGUAGES[input.lang];
  const from = Math.max(0, input.atSec - DOUBT_WINDOW_BEFORE_SEC);
  const to = input.atSec + DOUBT_WINDOW_AFTER_SEC;
  const window = segmentsBetween(input.english, from, to)
    .map((s) => `[${Math.round(s.startSec)}s] ${s.text}`)
    .join("\n");

  const system = library.prompt({
    preamble: [
      `You are a patient teaching assistant for the NPTEL lecture "${input.lectureTitle}".`,
      `A student paused at ${Math.round(input.atSec)}s and asked a doubt (possibly typed in romanized ${name} or English). Always answer in ${name} written in ${name} script, the way an Indian engineering student speaks it: technical terms, symbols and code stay in English (Latin script).`,
      "Answer from what the lecturer said in the transcript window first. If you need anything beyond it, put that part in a Callout with kind \"outside\".",
      "Include at least one TimeChip pointing at the moment in the window that the answer relies on. TimeChip seconds must come from the [Ns] markers.",
      "Shape the answer to the doubt, and keep it short: open with a KeyIdea that answers it in one sentence, then one or two short Paragraphs.",
      "When the doubt asks how two or three things differ or compare (difference, versus, which is better), answer the comparison with a Compare table instead of paragraphs: one row per point of difference, one column per thing.",
      "Otherwise add only what helps this doubt: Steps for a procedure or derivation; an Example when working a small problem makes it click; a Formula when there is one.",
      "End with one check the student can try, when it helps: a Reveal (think, then flip), or a single Mcq or TrueFalse whose sec comes from the [Ns] markers. Never more than one check.",
    ].join("\n"),
    additionalRules: [
      "Arguments are positional only. Never write `title:`, `sec:`, `label=` or any named argument.",
      "Output only openui-lang statements: no prose, no markdown fences, nothing after the last statement.",
      "Put every component in its own statement and reference it from root's parts array.",
      "Write maths as LaTeX: inline between single dollar signs, like $r_{12}^2$ or $\\frac{1}{2}mv^2$; a standalone equation between double dollar signs. It is typeset with KaTeX. Never put a dollar sign around plain words.",
      "Never write seconds or timestamps in Paragraph text (no \"216s\"); point at a moment only with a TimeChip.",
    ],
    examples: [EXAMPLE, COMPARE_EXAMPLE],
  });

  const user = [
    `Lecture concepts: ${input.concepts.map((c) => `${c.title} (${Math.round(c.startSec)}s)`).join("; ")}`,
    `Transcript window ${Math.round(from)}s–${Math.round(to)}s:`,
    window,
    "",
    `Student's doubt: ${input.question}`,
    "",
    answerLanguageReminder(input.lang),
  ].join("\n");

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}
