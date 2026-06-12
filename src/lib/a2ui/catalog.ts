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

const optionSchema = z.object({
  id: z.string(),
  label: z.string(),
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
