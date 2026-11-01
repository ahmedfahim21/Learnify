import { createLibrary, defineComponent } from "@openuidev/lang-core";
import { z } from "zod";

/**
 * The contract for doubt answers, and the base catalog study screens build
 * on (./screenSpec imports the shared specs from here): each component's
 * name, description and props, with no React. The server uses `doubtCore` to write the model's
 * prompt, validate answers and extract speech; the browser's library
 * (doubtLibrary.tsx) renders the same specs.
 *
 * Kept apart from the React library because Next.js route handlers run in the
 * server-components layer, where React has no createContext — and
 * @openuidev/react-lang calls it on import, so the React library can't load
 * on the server at all.
 */

export const ParagraphSpec = defineComponent({
  name: "Paragraph",
  // The model reliably writes a follow-on sentence as a second string (6 of 6
  // invalid answers in the spike did), so the catalog takes it.
  description: "A paragraph of explanation in the student's language, optionally followed by a second one.",
  props: z.object({ text: z.string(), continuation: z.string().optional() }),
  component: null,
});

export const StepsSpec = defineComponent({
  name: "Steps",
  description: "Numbered steps, e.g. working through a derivation or algorithm one move at a time.",
  props: z.object({ items: z.array(z.string()) }),
  component: null,
});

export const FormulaSpec = defineComponent({
  name: "Formula",
  description: "A formula or expression, written in plain text math such as 'T(n) = 2T(n/2) + n'.",
  props: z.object({ expression: z.string(), caption: z.string().optional() }),
  component: null,
});

export const TimeChipSpec = defineComponent({
  name: "TimeChip",
  description:
    "A link to a moment in this lecture. `sec` is seconds from the start; `label` says what happens there.",
  props: z.object({ sec: z.number(), label: z.string() }),
  component: null,
});

export const CalloutSpec = defineComponent({
  name: "Callout",
  description:
    "A short aside. kind 'note' for a tip, 'outside' when the content goes beyond what this lecture said.",
  props: z.object({ kind: z.enum(["note", "outside"]), text: z.string() }),
  component: null,
});

export const KeyIdeaSpec = defineComponent({
  name: "KeyIdea",
  description: "The one idea of a section to remember, in a sentence or two. Shown prominently.",
  props: z.object({ text: z.string() }),
  component: null,
});

export const ExampleSpec = defineComponent({
  name: "Example",
  description: "A worked example from the lecture (or one closely following it): a title, the problem, then the solution.",
  props: z.object({ title: z.string(), problem: z.string(), solution: z.string() }),
  component: null,
});

export const RevealSpec = defineComponent({
  name: "Reveal",
  description:
    "Active recall: a question the student should try to answer before tapping to see the answer. Use one or two per section.",
  props: z.object({ prompt: z.string(), answer: z.string() }),
  component: null,
});

export const McqSpec = defineComponent({
  name: "Mcq",
  description:
    "Multiple choice with exactly one right option. answerIndex is 0-based. explanation says why, from the lecture. sec is where the lecture covers it.",
  props: z.object({
    question: z.string(),
    options: z.array(z.string()),
    answerIndex: z.number(),
    explanation: z.string(),
    sec: z.number(),
  }),
  component: null,
});

export const TrueFalseSpec = defineComponent({
  name: "TrueFalse",
  description: "A statement that is true or false according to the lecture.",
  props: z.object({ statement: z.string(), answer: z.boolean(), explanation: z.string(), sec: z.number() }),
  component: null,
});

export const CompareSpec = defineComponent({
  name: "Compare",
  description:
    "A side-by-side comparison as a small table. headers: an empty first header for the row labels, then one per thing compared. rows: one per point of difference, each starting with that point's label, then a cell per thing. Use it when a doubt asks how two or three things differ.",
  props: z.object({ headers: z.array(z.string()), rows: z.array(z.array(z.string())) }),
  component: null,
});

export const AnswerSpec = defineComponent({
  name: "Answer",
  description: "The whole answer card: a short title, then its parts in reading order.",
  props: z.object({
    title: z.string(),
    parts: z.array(
      z.union([
        ParagraphSpec.ref,
        KeyIdeaSpec.ref,
        StepsSpec.ref,
        FormulaSpec.ref,
        ExampleSpec.ref,
        CompareSpec.ref,
        RevealSpec.ref,
        McqSpec.ref,
        TrueFalseSpec.ref,
        TimeChipSpec.ref,
        CalloutSpec.ref,
      ]),
    ),
  }),
  component: null,
});

export const DOUBT_SPECS = [
  AnswerSpec,
  ParagraphSpec,
  KeyIdeaSpec,
  StepsSpec,
  FormulaSpec,
  ExampleSpec,
  CompareSpec,
  RevealSpec,
  McqSpec,
  TrueFalseSpec,
  TimeChipSpec,
  CalloutSpec,
];

/** Server-side doubt library: prompt(), toJSONSchema(), no React. */
export const doubtCore = createLibrary({ root: "Answer", components: DOUBT_SPECS });

export type DoubtCore = typeof doubtCore;
