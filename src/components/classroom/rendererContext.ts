import {
  A2UI_VERSION,
  type A2UIActionMessage,
  type ComponentDef,
} from "@/lib/a2ui/messages";

/**
 * The shared boundary every A2UI widget renders against.
 *
 * Widgets live in `./widgets` and receive their component definition plus this
 * context; they never reach for the renderer's internals. `emitAction` is the
 * single channel a learner interaction travels back through, so every widget —
 * old or new — produces actions in exactly one shape.
 */
export interface NodeContext {
  surfaceId: string;
  resolve: (id: string) => ComponentDef | undefined;
  onAction: (action: A2UIActionMessage) => void;
  /** False when replaying a completed session: render, but don't accept input. */
  interactive: boolean;
}

/** Read a string property defensively (already catalog-validated upstream). */
export function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Read a finite number property, defaulting to 0. */
export function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Read an `{ id, label }[]` property defensively. */
export function readOptions(value: unknown): Array<{ id: string; label: string }> {
  return Array.isArray(value)
    ? (value as Array<{ id: string; label: string }>)
    : [];
}

/** Fire a learner interaction back through the renderer's action channel. */
export function emitAction(
  ctx: NodeContext,
  def: ComponentDef,
  action: string,
  payload: Record<string, unknown>,
) {
  ctx.onAction({
    type: "action",
    version: A2UI_VERSION,
    surfaceId: ctx.surfaceId,
    componentId: def.id,
    action,
    payload,
  });
}
