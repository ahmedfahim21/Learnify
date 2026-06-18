import { z } from "zod";

import { ComponentSchema } from "../a2ui/catalog";

/**
 * Tool definitions for the tutor agent, derived from the A2UI catalog.
 *
 * `present_ui` is the model's only way to put pixels on screen — it emits a
 * batch of components that are validated server-side against the catalog
 * (`validatePresentUi` in a2ui/emit; invalid input is bounced back to the model
 * with a repair prompt). `end_session` lets the model close the turn/session
 * deliberately.
 *
 * Note: `present_ui` is intentionally NOT a strict tool. The full widget
 * catalog (a 13-branch discriminated union nested in an array) compiles to a
 * decoding grammar too large for strict tool use, and the catalog only grows.
 * Server-side Zod validation + the loop's one-shot repair round-trip give us
 * the same correctness guarantee without the grammar-size ceiling.
 */

export const PRESENT_UI_TOOL_NAME = "present_ui";
export const END_SESSION_TOOL_NAME = "end_session";
export const UPDATE_PLAN_TOOL_NAME = "update_plan";
export const RECORD_EVIDENCE_TOOL_NAME = "record_evidence";

/** Session phases the tutor moves through (persisted to `sessions.plan`). */
export const SESSION_PHASES = [
  "diagnostic",
  "teach",
  "assess",
  "recap",
] as const;

/** Zod schema for the `present_ui` tool input — the contract with the model. */
export const presentUiInputSchema = z.object({
  surfaceId: z
    .string()
    .optional()
    .describe("Target surface id; defaults to the session's main surface."),
  root: z.string().describe("id of the root component in `components`."),
  mode: z
    .enum(["replace", "append"])
    .optional()
    .describe(
      "replace = new surface (createSurface); append = patch existing (updateComponents). Defaults to append.",
    ),
  components: z
    .array(ComponentSchema)
    .describe(
      "Flat list of components. Layout containers (Row/Column) reference children by id.",
    ),
});

export const endSessionInputSchema = z.object({
  reason: z
    .string()
    .optional()
    .describe("Short human-readable reason the session is ending."),
});

export const updatePlanInputSchema = z.object({
  phase: z
    .enum(SESSION_PHASES)
    .describe(
      "Current phase: diagnostic (probe before teaching), teach, assess, or recap.",
    ),
  remainingConceptIds: z
    .array(z.string())
    .optional()
    .describe("Concept ids still to cover, most important first."),
  note: z
    .string()
    .optional()
    .describe("One-line note on where the session stands."),
});

export const recordEvidenceInputSchema = z.object({
  conceptId: z
    .string()
    .optional()
    .describe("The concept this evidence is about, if known."),
  kind: z
    .enum(["mcq", "ordering", "matching", "flashcard", "free_text", "self_report"])
    .describe("What produced the evidence."),
  quality: z
    .number()
    .describe("Graded quality 0–5 (5 = mastered, 0 = no recall)."),
  note: z
    .string()
    .optional()
    .describe("Short observation (misconception, what worked)."),
});

/**
 * Recursively rewrite `oneOf` → `anyOf`. zod emits `oneOf` for discriminated
 * unions; `anyOf` is the more widely accepted spelling and is equivalent here
 * (the branches are mutually exclusive on `component`).
 */
function normalizeSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(normalizeSchema);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      out[key === "oneOf" ? "anyOf" : key] = normalizeSchema(value);
    }
    return out;
  }
  return node;
}

/** Strip keys strict tool use doesn't expect from a generated JSON schema. */
function toInputSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-2020-12" }) as Record<
    string,
    unknown
  >;
  delete json.$schema;
  return normalizeSchema(json) as Record<string, unknown>;
}

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  strict?: boolean;
}

export const presentUiTool: ToolDef = {
  name: PRESENT_UI_TOOL_NAME,
  description:
    "Render interactive UI to the learner. Emit one or more catalog widgets " +
    "(explanations, checks, recaps, layout). Use at most a few widgets per call; " +
    "build the lesson incrementally across turns.",
  input_schema: toInputSchema(presentUiInputSchema),
};

export const endSessionTool: ToolDef = {
  name: END_SESSION_TOOL_NAME,
  description:
    "End the current learning session. Call this after presenting a SessionRecap " +
    "when the learner has reached a natural stopping point.",
  input_schema: toInputSchema(endSessionInputSchema),
};

export const updatePlanTool: ToolDef = {
  name: UPDATE_PLAN_TOOL_NAME,
  description:
    "Record the session plan: the current phase and the concepts still to cover. " +
    "Call it when you start (set phase to diagnostic if there's no prior evidence) " +
    "and whenever the phase changes, so a resumed session knows where it left off.",
  input_schema: toInputSchema(updatePlanInputSchema),
};

export const recordEvidenceTool: ToolDef = {
  name: RECORD_EVIDENCE_TOOL_NAME,
  description:
    "Record graded evidence of the learner's mastery for answers the server " +
    "can't grade deterministically — free-text answers and self-reported recall. " +
    "Deterministic checks (MCQ, ordering, matching) are already graded for you.",
  input_schema: toInputSchema(recordEvidenceInputSchema),
};

export const TUTOR_TOOLS: ToolDef[] = [
  presentUiTool,
  updatePlanTool,
  recordEvidenceTool,
  endSessionTool,
];
