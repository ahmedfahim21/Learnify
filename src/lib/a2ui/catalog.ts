import { z } from "zod";

import { SIMULATOR_IDS } from "../sims/ids";

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
 * Closed icon vocabulary for {@link widgetProps.SystemDiagram} nodes. Each name
 * maps to one vetted icon component in `components/classroom/diagram/icons.ts`.
 * The enum is the security boundary: the model picks a *name*, never a glyph,
 * a path, or a URL.
 */
export const DIAGRAM_ICONS = [
  "client", "browser", "mobile", "user",
  "api", "gateway", "load-balancer", "proxy", "cdn", "dns", "firewall",
  "service", "worker", "function", "scheduler",
  "database", "sql", "nosql", "cache", "search-index", "vector-db",
  "blob-storage", "data-warehouse", "shard", "replica",
  "queue", "stream",
  "llm", "embedding", "agent",
  "auth", "monitoring", "config",
  "document", "web", "email", "chat", "notification", "payment",
  "region", "datacenter", "internet", "generic",
] as const;

/**
 * Accent vocabulary. Names map to literal Tailwind class bundles in the
 * renderer's palette — Tailwind v4 here is CSS-first with no config file, so
 * there is no safelist and an interpolated `border-${color}-400` would silently
 * render unstyled.
 */
export const DIAGRAM_COLORS = [
  "slate", "blue", "green", "pink", "purple",
  "amber", "cyan", "rose", "teal", "indigo",
] as const;

export type DiagramIcon = (typeof DIAGRAM_ICONS)[number];
export type DiagramColor = (typeof DIAGRAM_COLORS)[number];

/** One labelled box, placed on the diagram's coarse grid by `col`/`row`. */
const diagramNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  /** Small second line, e.g. "Postgres" or "p99 40ms". */
  sublabel: z.string().optional(),
  /**
   * A sentence or two revealed when the learner selects this node — what it
   * does, why it's here, what it would cost to remove. This is what makes a
   * diagram explorable rather than decorative.
   */
  detail: z.string().optional(),
  icon: z.enum(DIAGRAM_ICONS).optional(),
  /** 0-based grid cell. The renderer maps cells to pixels, so the model only
   *  ever reasons about composition, never geometry. */
  col: z.number(),
  row: z.number(),
  /** Cells spanned; defaults to 1. Use to widen a tier-spanning box. */
  colSpan: z.number().optional(),
  rowSpan: z.number().optional(),
  /** id of a {@link diagramGroupSchema} this node belongs to. */
  groupId: z.string().optional(),
  shape: z.enum(["box", "rounded", "cylinder", "pill", "hexagon"]).optional(),
  accent: z.enum(DIAGRAM_COLORS).optional(),
});

/**
 * A tinted region behind a set of nodes — the "Knowledge Sources" / "Large
 * Language Models" panels of the reference style. Geometry is optional: with no
 * rect, the region is the padded bounding box of its member nodes.
 */
const diagramGroupSchema = z.object({
  id: z.string(),
  label: z.string(),
  color: z.enum(DIAGRAM_COLORS),
  col: z.number().optional(),
  row: z.number().optional(),
  colSpan: z.number().optional(),
  rowSpan: z.number().optional(),
});

/** A directed connection between two nodes. */
const diagramEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
  /** 1-based step number, drawn as a badge at the edge's midpoint. */
  step: z.number().optional(),
  style: z.enum(["solid", "dashed"]).optional(),
  arrow: z.enum(["forward", "both", "none"]).optional(),
  /** Elbow strategy; "auto" picks one from the relative grid positions. */
  route: z
    .enum(["auto", "horizontal-first", "vertical-first", "straight"])
    .optional(),
});

/** One frame of the walkthrough: what lights up, and what the learner is told. */
const diagramStepSchema = z.object({
  index: z.number(),
  caption: z.string(),
  nodeIds: z.array(z.string()),
  edgeIds: z.array(z.string()),
});

/**
 * One control value for {@link widgetProps.Simulator}. A `{key, value}` array,
 * not `z.record` — `z.record` emits `additionalProperties` in the generated
 * JSON schema, which strict tool use rejects and which would let arbitrary
 * keys pass validation. Values are clamped against the simulator's own
 * declared range at render time (`src/lib/sims/types.ts`); the catalog can't
 * carry min/max per the strict-tool-safety rule above.
 */
const simulatorParamSchema = z.object({
  key: z.string(),
  value: z.union([z.number(), z.boolean()]),
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
    /**
     * Slug of the concept this check assesses. The server grades the answer and
     * routes the result into the mastery engine (#43); the renderer ignores it.
     */
    conceptSlug: z.string().optional(),
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
    /** Slug of the concept this exercise assesses (routes mastery evidence, #43). */
    conceptSlug: z.string().optional(),
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
    /** Slug of the concept this exercise assesses (routes mastery evidence, #43). */
    conceptSlug: z.string().optional(),
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
  /**
   * An architecture diagram with an optional animated step walkthrough — the
   * primary tool for teaching any request path, data flow, or system topology.
   *
   * Pure data: coarse grid coordinates, a closed icon enum, and declared steps.
   * The renderer draws HTML boxes over an SVG edge layer — no iframe, no CDN,
   * and nothing the model wrote is ever executed.
   */
  SystemDiagram: z.object({
    title: z.string().optional(),
    caption: z.string().optional(),
    /** Grid width in cells. */
    columns: z.number(),
    /** Grid height in cells. */
    rows: z.number(),
    nodes: z.array(diagramNodeSchema),
    edges: z.array(diagramEdgeSchema),
    groups: z.array(diagramGroupSchema).optional(),
    /** Ordered walkthrough; when present, the step player renders. */
    steps: z.array(diagramStepSchema).optional(),
    /** Start the walkthrough playing. Ignored under prefers-reduced-motion. */
    autoplay: z.boolean().optional(),
    /** Slug of the concept this diagram teaches (routes mastery evidence, #43). */
    conceptSlug: z.string().optional(),
  }),
  /**
   * A hand-built, parameterised simulator — the "explorable explanation"
   * counterpart to SystemDiagram. The model picks a simulator by id and
   * supplies initial parameters plus a "what to notice" prompt; ALL simulation
   * math lives in our code (`src/lib/sims`), so nothing the model authored is
   * ever executed — it only selects from a closed enum.
   */
  Simulator: z.object({
    simulatorId: z.enum(SIMULATOR_IDS),
    title: z.string().optional(),
    intro: z.string().optional(),
    /** The observation the learner should make while playing with it. */
    notice: z.string(),
    /** Initial control values; unknown keys dropped, missing keys defaulted,
     *  out-of-range values clamped — see resolveParams in lib/sims/types.ts. */
    params: z.array(simulatorParamSchema).optional(),
    /** Slug of the concept this simulator teaches (routes mastery evidence). */
    conceptSlug: z.string().optional(),
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
  SystemDiagram: "leaf",
  Simulator: "leaf",
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

export type SystemDiagramProps = z.infer<typeof widgetProps.SystemDiagram>;
export type DiagramNode = z.infer<typeof diagramNodeSchema>;
export type DiagramGroup = z.infer<typeof diagramGroupSchema>;
export type DiagramEdge = z.infer<typeof diagramEdgeSchema>;
export type DiagramStep = z.infer<typeof diagramStepSchema>;
export type SimulatorProps = z.infer<typeof widgetProps.Simulator>;
