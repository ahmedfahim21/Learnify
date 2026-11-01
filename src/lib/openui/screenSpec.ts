import { createLibrary, defineComponent } from "@openuidev/lang-core";
import { z } from "zod";

import {
  CalloutSpec,
  ExampleSpec,
  FormulaSpec,
  KeyIdeaSpec,
  McqSpec,
  ParagraphSpec,
  RevealSpec,
  StepsSpec,
  TimeChipSpec,
  TrueFalseSpec,
} from "./doubtSpec";

// Shared with doubt answers; defined in ./doubtSpec, the base catalog.
export { ExampleSpec, KeyIdeaSpec, McqSpec, RevealSpec, TrueFalseSpec };

/**
 * The catalog the model builds a lecture's study screens from: interactive
 * notes and practice quizzes, written in the student's language, grounded in
 * the lecture transcript. Server-safe (no React): the server prompts and
 * validates against `screenCore`; screenLibrary.tsx renders the same specs.
 *
 * Answers are part of the generated screen — quizzes grade in the browser,
 * which keeps every question type instant. These are practice, not exams.
 */

// --- Notes -------------------------------------------------------------------

const NoteChild = z.union([
  KeyIdeaSpec.ref,
  ParagraphSpec.ref,
  ExampleSpec.ref,
  RevealSpec.ref,
  StepsSpec.ref,
  FormulaSpec.ref,
  TimeChipSpec.ref,
  CalloutSpec.ref,
]);

export const SectionSpec = defineComponent({
  name: "Section",
  description: "One topic of the lecture, in lecture order: a heading, the second it starts at, then its parts.",
  props: z.object({ heading: z.string(), sec: z.number(), parts: z.array(NoteChild) }),
  component: null,
});

// --- Quiz --------------------------------------------------------------------

export const FillBlankSpec = defineComponent({
  name: "FillBlank",
  description:
    "A sentence with one blank written as ___ . answer is the missing word or short phrase. alternatives are other ways of writing that SAME correct answer (another spelling, the English or native-script word); never wrong options. Use [] when there are none.",
  props: z.object({
    prompt: z.string(),
    answer: z.string(),
    alternatives: z.array(z.string()),
    explanation: z.string(),
    sec: z.number(),
  }),
  component: null,
});

export const MatchPairsSpec = defineComponent({
  name: "MatchPairs",
  description:
    "Match each left item to its right item. left and right are the same length and right[i] is the match for left[i]; the screen shuffles them.",
  props: z.object({
    instruction: z.string(),
    left: z.array(z.string()),
    right: z.array(z.string()),
    explanation: z.string(),
    sec: z.number(),
  }),
  component: null,
});

export const OrderStepsSpec = defineComponent({
  name: "OrderSteps",
  description: "Put the steps of a process from the lecture in order. steps is the correct order; the screen shuffles them.",
  props: z.object({ instruction: z.string(), steps: z.array(z.string()), explanation: z.string(), sec: z.number() }),
  component: null,
});

export const QuizSpec = defineComponent({
  name: "Quiz",
  description: "A practice quiz: a title, then its questions in lecture order. The screen keeps score.",
  props: z.object({
    title: z.string(),
    questions: z.array(z.union([McqSpec.ref, TrueFalseSpec.ref, FillBlankSpec.ref, MatchPairsSpec.ref, OrderStepsSpec.ref])),
  }),
  component: null,
});

// --- Root --------------------------------------------------------------------

export const ScreenSpec = defineComponent({
  name: "Screen",
  description: "A whole study screen: a title, then sections or a quiz.",
  props: z.object({ title: z.string(), parts: z.array(z.union([SectionSpec.ref, QuizSpec.ref, NoteChild])) }),
  component: null,
});

export const SCREEN_SPECS = [
  ScreenSpec,
  SectionSpec,
  KeyIdeaSpec,
  ExampleSpec,
  RevealSpec,
  QuizSpec,
  McqSpec,
  TrueFalseSpec,
  FillBlankSpec,
  MatchPairsSpec,
  OrderStepsSpec,
  ParagraphSpec,
  StepsSpec,
  FormulaSpec,
  TimeChipSpec,
  CalloutSpec,
];

/** Server-side study-screen library: prompt(), toJSONSchema(), no React. */
export const screenCore = createLibrary({ root: "Screen", components: SCREEN_SPECS });

export type ScreenCore = typeof screenCore;
