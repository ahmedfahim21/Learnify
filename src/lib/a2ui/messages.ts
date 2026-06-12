/**
 * A2UI v0.9 — declarative UI protocol (server → client + client → server).
 *
 * Learnify owns these types so the renderer dependency stays isolated to a
 * single boundary. The tutor agent emits {@link A2UIServerMessage} envelopes;
 * the browser renders them from a safe widget catalog and replies with
 * {@link A2UIActionMessage} when the learner interacts.
 *
 * Layout uses **flat adjacency**: every component is a flat entry keyed by a
 * stable `id`, and containers reference their children by id (`children`)
 * rather than nesting. This keeps streaming/patching cheap — an update can
 * replace one component without re-sending its subtree.
 */

export const A2UI_VERSION = "0.9" as const;

/** A single declarative component instance. */
export interface ComponentDef {
  /** Stable, unique-within-surface identifier. */
  id: string;
  /** Widget type — must be a name registered in the catalog. */
  component: string;
  /** Validated widget properties (shape depends on `component`). */
  properties: Record<string, unknown>;
  /** Child component ids, for layout containers (flat adjacency). */
  children?: string[];
}

/** Create a new surface (screen/region) with its initial component tree. */
export interface CreateSurfaceMessage {
  type: "createSurface";
  version: typeof A2UI_VERSION;
  surfaceId: string;
  /** id of the root component within `components`. */
  root: string;
  components: ComponentDef[];
}

/** Upsert components into an existing surface (by id). */
export interface UpdateComponentsMessage {
  type: "updateComponents";
  version: typeof A2UI_VERSION;
  surfaceId: string;
  /** Components to add or replace, matched by `id`. */
  components: ComponentDef[];
}

/** Patch the surface's data model (bound values referenced by components). */
export interface UpdateDataModelMessage {
  type: "updateDataModel";
  version: typeof A2UI_VERSION;
  surfaceId: string;
  data: Record<string, unknown>;
}

/** Tear down a surface and everything in it. */
export interface DeleteSurfaceMessage {
  type: "deleteSurface";
  version: typeof A2UI_VERSION;
  surfaceId: string;
}

/** Any server → client envelope. */
export type A2UIServerMessage =
  | CreateSurfaceMessage
  | UpdateComponentsMessage
  | UpdateDataModelMessage
  | DeleteSurfaceMessage;

/**
 * Client → server message: a learner interaction (button press, choice
 * selection, etc.). Fed back to the agent loop as a `tool_result` / user turn.
 */
export interface A2UIActionMessage {
  type: "action";
  version: typeof A2UI_VERSION;
  surfaceId: string;
  /** id of the component that produced the action. */
  componentId: string;
  /** Action name, e.g. "submit" | "select". */
  action: string;
  payload?: Record<string, unknown>;
}

export function isA2UIServerMessage(value: unknown): value is A2UIServerMessage {
  if (typeof value !== "object" || value === null) return false;
  const type = (value as { type?: unknown }).type;
  return (
    type === "createSurface" ||
    type === "updateComponents" ||
    type === "updateDataModel" ||
    type === "deleteSurface"
  );
}
