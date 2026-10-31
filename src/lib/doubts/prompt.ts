import { LANGUAGES, type Lang } from "@/lib/languages";
import type { doubtLibrary } from "@/lib/openui/doubtLibrary";
import { segmentsBetween, type Segment } from "@/lib/transcripts/merge";

/**
 * Prompt for answering a student's doubt as an OpenUI Lang card, grounded in
 * what the lecturer said just before the moment they paused.
 */

export const DOUBT_WINDOW_BEFORE_SEC = 180;
export const DOUBT_WINDOW_AFTER_SEC = 20;

/** One worked answer, so the model sees positional syntax and the code-mixed register. */
const EXAMPLE = [
  'root = Answer("ஏன் n-ஆல் divide பண்றோம்?", [p1, f1, t1, c1])',
  'p1 = Paragraph("Average கண்டுபிடிக்க எல்லா values-ஐயும் add பண்ணி, மொத்தம் எத்தனை values இருக்கோ அந்த count-ஆல divide பண்றோம். இங்க count தான் n.")',
  'f1 = Formula("mean = (x1 + x2 + ... + xn) / n", "n = number of values")',
  't1 = TimeChip(312, "Average-ஐ define பண்ற இடம்")',
  'c1 = Callout("note", "n-க்கு பதிலா n-1 use பண்றது sample variance-ல மட்டும் தான்.")',
].join("\n");

export interface DoubtInput {
  lectureTitle: string;
  lang: Lang;
  atSec: number;
  question: string;
  english: Segment[];
  concepts: { title: string; startSec: number }[];
}

export function doubtMessages(input: DoubtInput, library: typeof doubtLibrary) {
  const { name } = LANGUAGES[input.lang];
  const from = Math.max(0, input.atSec - DOUBT_WINDOW_BEFORE_SEC);
  const to = input.atSec + DOUBT_WINDOW_AFTER_SEC;
  const window = segmentsBetween(input.english, from, to)
    .map((s) => `[${Math.round(s.startSec)}s] ${s.text}`)
    .join("\n");

  const system = library.prompt({
    preamble: [
      `You are a patient teaching assistant for the IIT lecture "${input.lectureTitle}".`,
      `A student paused at ${Math.round(input.atSec)}s and asked a doubt (possibly typed in romanized ${name} or English). Always answer in ${name} written in ${name} script, the way an Indian engineering student speaks it: technical terms, symbols and code stay in English (Latin script).`,
      "Answer from what the lecturer said in the transcript window first. If you need anything beyond it, put that part in a Callout with kind \"outside\".",
      "Include at least one TimeChip pointing at the moment in the window that the answer relies on. TimeChip seconds must come from the [Ns] markers.",
      "Keep it short: a title, one to three Paragraphs, and Steps or a Formula only when they help.",
    ].join("\n"),
    additionalRules: [
      "Arguments are positional only. Never write `title:`, `sec:`, `label=` or any named argument.",
      "Output only openui-lang statements: no prose, no markdown fences, nothing after the last statement.",
      "Put every component in its own statement and reference it from root's parts array.",
    ],
    examples: [EXAMPLE],
  });

  const user = [
    `Lecture concepts: ${input.concepts.map((c) => `${c.title} (${Math.round(c.startSec)}s)`).join("; ")}`,
    `Transcript window ${Math.round(from)}s–${Math.round(to)}s:`,
    window,
    "",
    `Student's doubt: ${input.question}`,
  ].join("\n");

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}
