import { z } from "zod";

import { ComponentSchema, type ValidatedComponent } from "./catalog";
import {
  A2UI_VERSION,
  type ComponentDef,
  type CreateSurfaceMessage,
  type UpdateComponentsMessage,
} from "./messages";

/**
 * Turn validated component definitions into A2UI v0.9 envelopes.
 *
 * Validation is atomic per block: a single malformed component fails the whole
 * emission (so the agent loop can retry) rather than rendering a half-broken
 * surface.
 */

/**
 * Hard cap on top-level widgets emitted in a single `present_ui` call — a guard
 * against a runaway turn that dumps a wall of UI. The tutor is told to emit ≤3;
 * this is the server-enforced ceiling that bounces excess back for a retry.
 */
export const MAX_TOP_LEVEL_WIDGETS = 6;

export class A2UIValidationError extends Error {
  constructor(
    message: string,
    readonly issues: z.core.$ZodIssue[],
  ) {
    super(message);
    this.name = "A2UIValidationError";
  }
}

export interface ValidatePresentUiInput {
  surfaceId?: string;
  root: string;
  components: unknown;
  mode?: "replace" | "append";
}

export interface ValidatedPresentUi {
  surfaceId: string;
  root: string;
  components: ValidatedComponent[];
  mode: "replace" | "append";
}

/**
 * Validate the raw `present_ui` tool input against the catalog and check
 * referential integrity (root exists, children resolve, ids unique).
 * Throws {@link A2UIValidationError} on any problem.
 */
export function validatePresentUi(
  input: ValidatePresentUiInput,
  fallbackSurfaceId: string,
): ValidatedPresentUi {
  const parsed = z.array(ComponentSchema).safeParse(input.components);
  if (!parsed.success) {
    throw new A2UIValidationError(
      "One or more components failed catalog validation.",
      parsed.error.issues,
    );
  }

  const components = parsed.data;
  const ids = new Set<string>();
  for (const c of components) {
    if (ids.has(c.id)) {
      throw new A2UIValidationError(`Duplicate component id "${c.id}".`, []);
    }
    ids.add(c.id);
  }

  if (!ids.has(input.root)) {
    throw new A2UIValidationError(
      `Root component "${input.root}" is not present in components.`,
      [],
    );
  }

  const childIds = new Set<string>();
  for (const c of components) {
    for (const childId of c.children ?? []) {
      if (!ids.has(childId)) {
        throw new A2UIValidationError(
          `Component "${c.id}" references unknown child "${childId}".`,
          [],
        );
      }
      childIds.add(childId);
    }
  }

  const topLevelCount = components.filter((c) => !childIds.has(c.id)).length;
  if (topLevelCount > MAX_TOP_LEVEL_WIDGETS) {
    throw new A2UIValidationError(
      `Too many top-level widgets (${topLevelCount}); emit at most ${MAX_TOP_LEVEL_WIDGETS} per call. Split the lesson across turns.`,
      [],
    );
  }

  return {
    surfaceId: input.surfaceId ?? fallbackSurfaceId,
    root: input.root,
    components,
    mode: input.mode ?? "append",
  };
}

/** Build the A2UI envelope for a validated `present_ui` emission. */
export function toEnvelope(
  validated: ValidatedPresentUi,
): CreateSurfaceMessage | UpdateComponentsMessage {
  const components = validated.components as unknown as ComponentDef[];
  if (validated.mode === "replace") {
    return {
      type: "createSurface",
      version: A2UI_VERSION,
      surfaceId: validated.surfaceId,
      root: validated.root,
      components,
    };
  }
  return {
    type: "updateComponents",
    version: A2UI_VERSION,
    surfaceId: validated.surfaceId,
    components,
  };
}

/** Convenience: a single Narration component wrapped in an update envelope. */
export function narrationEnvelope(
  surfaceId: string,
  id: string,
  text: string,
): UpdateComponentsMessage {
  return {
    type: "updateComponents",
    version: A2UI_VERSION,
    surfaceId,
    components: [{ id, component: "Narration", properties: { text } }],
  };
}
