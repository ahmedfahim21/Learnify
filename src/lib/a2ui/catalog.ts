import { z } from "zod";

/**
 * The Phase-1 A2UI widget catalog — the single source of truth for:
 *   1. the `present_ui` tool schema the model emits against (strict tool use),
 *   2. server-side validation of every component before it's rendered, and
 *   3. (in later phases) client-side renderer registration.
 *
 * Adding a widget here automatically threads it through all three: define its
 * props schema, register it in `CATALOG`, and the discriminated union +
 * generated JSON schema pick it up.
 */

/** Layout containers reference children by id; leaf widgets do not. */
export type WidgetKind = "leaf" | "container";

/** An `{ id, label }` pair — used for options, orderable items, match columns. */
const optionSchema = z.object({
  id: z.string(),
  label: z.string(),
});

/** One labelled progress bar for {@link ProgressMeter}. */
const conceptProgressSchema = z.object({
  label: z.string(),
  /** Mastery on a 0–1 scale; the renderer clamps out-of-range values. */
  mastery: z.number(),
});

/** A correct left→right match, used as the server-side grading key. */
const correctPairSchema = z.object({
  leftId: z.string(),
  rightId: z.string(),
});

/**
 * Per-widget property schemas. Keep these strict and flat — strict tool use
 * forbids unsupported JSON-schema constraints, so no `min`/`max`/`regex`.
 */
export const widgetProps = {
  /** Streamed tutor prose — the default "talking" block. */
  Narration: z.object({
    text: z.string(),
  }),
  /** A titled explanation with optional accent emoji. */
  ExplanationCard: z.object({
    title: z.string(),
    body: z.string(),
    emoji: z.string().optional(),
  }),
  /** A single multiple-choice comprehension check. */
  MultipleChoiceCheck: z.object({
    prompt: z.string(),
    options: z.array(optionSchema),
    correctOptionId: z.string(),
    explanation: z.string().optional(),
  }),
  /** A flippable card; the learner self-rates recall (SM-2 quality 0–5). */
  Flashcard: z.object({
    front: z.string(),
    back: z.string(),
    hint: z.string().optional(),
  }),
  /** Items to put in the correct sequence (learner reorders, then submits). */
  OrderingExercise: z.object({
    prompt: z.string(),
    /** Presented scrambled; the renderer never reveals the right order. */
    items: z.array(optionSchema),
    /**
     * The correct sequence of `items` ids — the server grades the learner's
     * submission against this (the renderer ignores it). Always provide it.
     */
    correctOrder: z.array(z.string()).optional(),
  }),
  /** Match each left item to its partner on the right. */
  MatchingPairs: z.object({
    prompt: z.string().optional(),
    left: z.array(optionSchema),
    right: z.array(optionSchema),
    /**
     * The correct left→right matches — the server grades against this (the
     * renderer ignores it). Always provide it.
     */
    correctPairs: z.array(correctPairSchema).optional(),
  }),
  /** A read-only code block with optional language + emphasized lines. */
  CodeSnippet: z.object({
    code: z.string(),
    language: z.string().optional(),
    caption: z.string().optional(),
    /** 1-based line numbers to highlight. */
    highlightLines: z.array(z.number()).optional(),
  }),
  /** A Mermaid diagram, rendered in a sandboxed iframe; nodes emit clicks. */
  Diagram: z.object({
    /** Mermaid source (e.g. `graph TD; A-->B`). */
    source: z.string(),
    caption: z.string().optional(),
  }),
  /** A free-text prompt; the learner writes a short answer. */
  FreeResponse: z.object({
    prompt: z.string(),
    placeholder: z.string().optional(),
  }),
  /** Per-concept mastery bars plus the current session phase. */
  ProgressMeter: z.object({
    concepts: z.array(conceptProgressSchema),
    phase: z.string().optional(),
  }),
  /** End-of-session summary. */
  SessionRecap: z.object({
    summary: z.string(),
    keyPoints: z.array(z.string()),
    nextUp: z.string().optional(),
  }),
  /** Horizontal layout container. */
  Row: z.object({
    gap: z.number().optional(),
  }),
  /** Vertical layout container. */
  Column: z.object({
    gap: z.number().optional(),
  }),
} as const;

export type WidgetName = keyof typeof widgetProps;

export const WIDGET_KIND: Record<WidgetName, WidgetKind> = {
  Narration: "leaf",
  ExplanationCard: "leaf",
  MultipleChoiceCheck: "leaf",
  Flashcard: "leaf",
  OrderingExercise: "leaf",
  MatchingPairs: "leaf",
  CodeSnippet: "leaf",
  Diagram: "leaf",
  FreeResponse: "leaf",
  ProgressMeter: "leaf",
  SessionRecap: "leaf",
  Row: "container",
  Column: "container",
};

/** Build the `{ id, component, properties, children? }` schema for one widget. */
function componentSchemaFor<N extends WidgetName>(name: N) {
  const base = {
    id: z.string(),
    component: z.literal(name),
    properties: widgetProps[name],
  };
  return WIDGET_KIND[name] === "container"
    ? z.object({ ...base, children: z.array(z.string()) })
    : z.object({ ...base, children: z.array(z.string()).optional() });
}

const componentSchemas = (
  Object.keys(widgetProps) as WidgetName[]
).map((name) => componentSchemaFor(name));

/**
 * A validated A2UI component: a discriminated union over `component`, so the
 * `properties` shape is enforced per widget type.
 */
export const ComponentSchema = z.discriminatedUnion(
  "component",
  // zod's discriminatedUnion needs a non-empty tuple type at compile time.
  componentSchemas as unknown as [
    ReturnType<typeof componentSchemaFor>,
    ...ReturnType<typeof componentSchemaFor>[],
  ],
);

export type ValidatedComponent = z.infer<typeof ComponentSchema>;

export const WIDGET_NAMES = Object.keys(widgetProps) as WidgetName[];
