import { createLibrary, defineComponent } from "@openuidev/lang-core";
import { z } from "zod";

/**
 * The contract for doubt answers: each component's name, description and
 * props, with no React. The server uses `doubtCore` to write the model's
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

export const AnswerSpec = defineComponent({
  name: "Answer",
  description: "The whole answer card: a short title, then its parts in reading order.",
  props: z.object({
    title: z.string(),
    parts: z.array(z.union([ParagraphSpec.ref, StepsSpec.ref, FormulaSpec.ref, TimeChipSpec.ref, CalloutSpec.ref])),
  }),
  component: null,
});

export const DOUBT_SPECS = [AnswerSpec, ParagraphSpec, StepsSpec, FormulaSpec, TimeChipSpec, CalloutSpec];

/** Server-side doubt library: prompt(), toJSONSchema(), no React. */
export const doubtCore = createLibrary({ root: "Answer", components: DOUBT_SPECS });

export type DoubtCore = typeof doubtCore;
