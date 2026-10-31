import { LANGUAGES, type Lang } from "@/lib/languages";
import type { ScreenCore } from "@/lib/openui/screenSpec";
import type { Segment } from "@/lib/transcripts/merge";

/**
 * Prompts for generated study screens. The model reads the English transcript
 * (with [Ns] second markers) and writes one OpenUI Lang program in the
 * student's language. Two worked examples pin the syntax: positional
 * arguments, one statement per component, every statement reachable from root.
 */

export type ScreenKind = "notes" | "quiz";
export type ScreenVariant = "standard" | "simpler" | "harder";

/** ~15K tokens of English: a full hour-long lecture fits the conversations model's 32K context with room to answer. */
const MAX_TRANSCRIPT_CHARS = 60_000;

export const NOTES_EXAMPLE = [
  'root = Screen("Rational numbers and decimals", [s1, s2])',
  's1 = Section("What a rational number is", 210, [k1, p1, r1, t1])',
  'k1 = KeyIdea("A rational number can be written as p/q with p an integer and q a natural number.")',
  'p1 = Paragraph("Every integer is rational, because n = n/1. Fractions like 3/4 are rational too.")',
  'r1 = Reveal("Is 0.333... rational?", "Yes: it equals 1/3.")',
  't1 = TimeChip(216, "Where the lecturer defines rational numbers")',
  's2 = Section("Decimal expansions", 250, [p2, e1, f1])',
  'p2 = Paragraph("A rational number\'s decimal expansion either terminates or repeats.")',
  'e1 = Example("Is 1/3 terminating?", "Divide 1 by 3.", "1 ÷ 3 = 0.333..., the 3 repeats forever, so it recurs.")',
  'f1 = Formula("1/3 = 0.333...", "The digit 3 repeats")',
].join("\n");

export const QUIZ_EXAMPLE = [
  'root = Screen("Practice: rational numbers", [quiz])',
  'quiz = Quiz("Rational numbers", [q1, q2, q3, q4, q5])',
  'q1 = Mcq("Which of these is irrational?", ["1/3", "0.25", "√2", "-4"], 2, "√2 has a non-terminating, non-repeating decimal expansion.", 300)',
  'q2 = TrueFalse("Every integer is a rational number.", true, "n = n/1, so every integer is p/q.", 216)',
  'q3 = FillBlank("A rational number\'s decimal expansion either terminates or ___.", "repeats", ["recurs", "is recurring"], "Terminating or recurring is the defining property.", 250)',
  'q4 = MatchPairs("Match each set to its symbol.", ["Natural numbers", "Integers", "Rationals"], ["N", "Z", "Q"], "These are the standard symbols used in the lecture.", 48)',
  'q5 = OrderSteps("Order the sets from smallest to largest.", ["N", "Z", "Q", "R"], "Each set contains the one before it.", 60)',
].join("\n");

function preamble(kind: ScreenKind, variant: ScreenVariant, lang: Lang, title: string): string {
  const { name } = LANGUAGES[lang];
  const language =
    lang === "en"
      ? "Write in clear English."
      : `Write every string the student reads — titles, headings, KeyIdeas, questions, options, explanations — in ${name}, in ${name} script, the way an Indian engineering student speaks it: only technical terms, symbols, variable names and formulas stay in English (Latin script).`;
  const task =
    kind === "notes"
      ? [
          "Write interactive study notes for this lecture.",
          "3 to 6 Sections in lecture order, each starting with a KeyIdea, then one or two short Paragraphs of 2-3 sentences.",
          "Every Section has at least one Reveal: a question the student answers in their head before revealing.",
          "Add an Example where the lecture works one, a Formula where the lecture uses one, and a TimeChip to where it is explained.",
          "End with a Section titled as a recap of the whole lecture.",
          "Notes contain no quiz components (no Mcq, TrueFalse, FillBlank, MatchPairs, OrderSteps, Quiz).",
        ]
      : [
          "Write a practice quiz on this lecture: one Quiz with 8 to 10 questions in lecture order.",
          "The program is exactly: root = Screen(title, [quiz]), the Quiz, and its questions. No Sections, Paragraphs, KeyIdeas or notes: they waste the space the questions need.",
          "Mix the types: at least 3 Mcq, 1 TrueFalse, 1 FillBlank, 1 MatchPairs, and 1 OrderSteps if the lecture describes a process or ordering.",
          "Each question tests what the lecture actually says. Mcq has 4 distinct options and exactly one right answer; spread right answers across positions.",
          "Every explanation says why, using the lecture. Every sec is a [Ns] marker where the answer is explained.",
          "FillBlank alternatives are only other spellings of the correct answer, never distractors: anything listed there is marked right.",
        ];
  const style =
    variant === "simpler"
      ? "This student found the lecture hard: use shorter sentences, everyday analogies and more examples; keep questions direct."
      : variant === "harder"
        ? "This student wants a challenge: go deeper into why and when ideas apply, edge cases and application; questions should need reasoning, not recall."
        : "";
  return [
    `You turn an IIT lecture into a study screen. Lecture: "${title}".`,
    language,
    ...task,
    style,
    "Use only what the transcript says; never invent facts the lecture doesn't support. Seconds come only from [Ns] markers.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Repeated after the transcript: the worked examples are in English, and on
 * notes the model followed them rather than the system prompt's language rule.
 */
function languageReminder(lang: Lang): string {
  if (lang === "en") return "Write the screen in English.";
  const { name, native } = LANGUAGES[lang];
  return `Write the whole screen in ${name} (${native}), in ${name} script — every title, heading, KeyIdea, Paragraph, Reveal and Example — keeping only technical terms and formulas in English. The worked example is in English only to show the syntax.`;
}

export function transcriptForScreen(segments: Segment[]): string {
  let out = "";
  for (const s of segments) {
    const line = `[${Math.round(s.startSec)}s] ${s.text}\n`;
    if (out.length + line.length > MAX_TRANSCRIPT_CHARS) break;
    out += line;
  }
  return out;
}

export function screenMessages(
  input: { title: string; lang: Lang; kind: ScreenKind; variant: ScreenVariant; english: Segment[] },
  library: ScreenCore,
) {
  const system = library.prompt({
    preamble: preamble(input.kind, input.variant, input.lang, input.title),
    additionalRules: [
      "Arguments are positional only. Never write named arguments like title: or sec=.",
      "Output only openui-lang statements: no prose, no markdown fences, nothing after the last statement.",
      "Put every component in its own statement and reference it from its parent; root must be Screen.",
      "Paragraph takes one string, plus an optional second for a follow-on paragraph.",
      "Write maths as LaTeX: inline between single dollar signs, like $r_{12}^2$ or $\\frac{1}{2}mv^2$; a standalone equation between double dollar signs. It is typeset with KaTeX. Never put a dollar sign around plain words.",
      "Never write seconds, timestamps or the word \"transcript\" in any text the student reads; say \"the lecture\", and point at moments only with TimeChip or sec arguments.",
    ],
    examples: [input.kind === "notes" ? NOTES_EXAMPLE : QUIZ_EXAMPLE],
  });
  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: `Transcript:\n${transcriptForScreen(input.english)}\n${languageReminder(input.lang)}` },
  ];
}
