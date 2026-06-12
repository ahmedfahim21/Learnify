"use client";

import { useState } from "react";

import {
  A2UI_VERSION,
  type A2UIActionMessage,
  type A2UIServerMessage,
  type ComponentDef,
} from "@/lib/a2ui/messages";

import { Markdown } from "./Markdown";

/**
 * Hand-rolled A2UI v0.9 renderer — the single boundary between the protocol and
 * React. The issue pre-planned this reducer-over-four-envelopes fallback in case
 * the upstream `@a2ui/react` v0.9 preview proved unusable; we adopt it so the
 * slice has no unstable preview dependency. Swapping the package in later means
 * re-fronting the same `rendererReducer` + `SurfaceRenderer` interface.
 *
 * The tutor streams components into a single session surface via append-mode
 * `updateComponents` (no declared root), so the renderer creates surfaces on
 * demand and renders every *top-level* component — one not referenced as
 * another component's child — in arrival order.
 */

export interface SurfaceState {
  surfaceId: string;
  /** Component ids in first-seen order. */
  order: string[];
  components: Record<string, ComponentDef>;
  data: Record<string, unknown>;
}

export interface RendererState {
  surfaceOrder: string[];
  surfaces: Record<string, SurfaceState>;
}

export const initialRendererState: RendererState = {
  surfaceOrder: [],
  surfaces: {},
};

export type RendererAction = A2UIServerMessage | { type: "reset" };

function emptySurface(surfaceId: string): SurfaceState {
  return { surfaceId, order: [], components: {}, data: {} };
}

/** Upsert components into a surface, preserving first-seen order. */
function upsert(surface: SurfaceState, components: ComponentDef[]): SurfaceState {
  const map = { ...surface.components };
  const order = [...surface.order];
  for (const component of components) {
    if (!(component.id in map)) order.push(component.id);
    map[component.id] = component;
  }
  return { ...surface, components: map, order };
}

export function rendererReducer(
  state: RendererState,
  action: RendererAction,
): RendererState {
  switch (action.type) {
    case "reset":
      return initialRendererState;

    case "createSurface": {
      const fresh = upsert(emptySurface(action.surfaceId), action.components);
      const surfaceOrder = state.surfaceOrder.includes(action.surfaceId)
        ? state.surfaceOrder
        : [...state.surfaceOrder, action.surfaceId];
      return {
        surfaceOrder,
        surfaces: { ...state.surfaces, [action.surfaceId]: fresh },
      };
    }

    case "updateComponents": {
      const base = state.surfaces[action.surfaceId] ?? emptySurface(action.surfaceId);
      const surfaceOrder = state.surfaceOrder.includes(action.surfaceId)
        ? state.surfaceOrder
        : [...state.surfaceOrder, action.surfaceId];
      return {
        surfaceOrder,
        surfaces: {
          ...state.surfaces,
          [action.surfaceId]: upsert(base, action.components),
        },
      };
    }

    case "updateDataModel": {
      const existing = state.surfaces[action.surfaceId];
      if (!existing) return state;
      return {
        ...state,
        surfaces: {
          ...state.surfaces,
          [action.surfaceId]: {
            ...existing,
            data: { ...existing.data, ...action.data },
          },
        },
      };
    }

    case "deleteSurface": {
      if (!state.surfaces[action.surfaceId]) return state;
      const surfaces = { ...state.surfaces };
      delete surfaces[action.surfaceId];
      return {
        surfaceOrder: state.surfaceOrder.filter((id) => id !== action.surfaceId),
        surfaces,
      };
    }

    default:
      return state;
  }
}

interface NodeContext {
  surfaceId: string;
  resolve: (id: string) => ComponentDef | undefined;
  onAction: (action: A2UIActionMessage) => void;
  interactive: boolean;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function MultipleChoiceCheck({
  def,
  ctx,
}: {
  def: ComponentDef;
  ctx: NodeContext;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const prompt = asString(def.properties.prompt);
  const options = Array.isArray(def.properties.options)
    ? (def.properties.options as Array<{ id: string; label: string }>)
    : [];

  return (
    <div className="space-y-3 rounded-xl border border-white/15 bg-white/[0.03] p-4">
      <p className="font-medium">{prompt}</p>
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const isChosen = chosen === option.id;
          const locked = chosen !== null || !ctx.interactive;
          return (
            <button
              key={option.id}
              type="button"
              disabled={locked}
              onClick={() => {
                setChosen(option.id);
                ctx.onAction({
                  type: "action",
                  version: A2UI_VERSION,
                  surfaceId: ctx.surfaceId,
                  componentId: def.id,
                  action: "select",
                  payload: { optionId: option.id, label: option.label },
                });
              }}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                isChosen
                  ? "border-white/60 bg-white/15"
                  : "border-white/15 hover:border-white/40 hover:bg-white/[0.06]"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SessionRecap({ def }: { def: ComponentDef }) {
  const summary = asString(def.properties.summary);
  const keyPoints = Array.isArray(def.properties.keyPoints)
    ? (def.properties.keyPoints as unknown[]).map(asString)
    : [];
  const nextUp = asString(def.properties.nextUp);

  return (
    <div className="space-y-3 rounded-xl border border-emerald-400/30 bg-emerald-400/[0.06] p-4">
      <div className="text-white/85">
        <Markdown text={summary} />
      </div>
      {keyPoints.length > 0 && (
        <ul className="ml-5 list-disc space-y-1 text-sm text-white/80">
          {keyPoints.map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ul>
      )}
      {nextUp && (
        <p className="text-sm text-white/60">
          <span className="font-medium text-white/80">Next up:</span> {nextUp}
        </p>
      )}
    </div>
  );
}

function renderNode(id: string, ctx: NodeContext): React.ReactNode {
  const def = ctx.resolve(id);
  if (!def) return null;

  switch (def.component) {
    case "Narration":
      return (
        <div key={id} className="text-white/85">
          <Markdown text={asString(def.properties.text)} />
        </div>
      );

    case "ExplanationCard": {
      const emoji = asString(def.properties.emoji);
      return (
        <div
          key={id}
          className="space-y-2 rounded-xl border border-white/15 bg-white/[0.04] p-4"
        >
          <h3 className="text-lg font-semibold">
            {emoji ? `${emoji} ` : ""}
            {asString(def.properties.title)}
          </h3>
          <div className="text-white/80">
            <Markdown text={asString(def.properties.body)} />
          </div>
        </div>
      );
    }

    case "MultipleChoiceCheck":
      return <MultipleChoiceCheck key={id} def={def} ctx={ctx} />;

    case "SessionRecap":
      return <SessionRecap key={id} def={def} />;

    case "Row":
      return (
        <div key={id} className="flex flex-wrap gap-4">
          {(def.children ?? []).map((childId) => renderNode(childId, ctx))}
        </div>
      );

    case "Column":
      return (
        <div key={id} className="flex flex-col gap-4">
          {(def.children ?? []).map((childId) => renderNode(childId, ctx))}
        </div>
      );

    default:
      return (
        <div
          key={id}
          className="rounded border border-amber-400/40 bg-amber-400/10 p-2 text-xs text-amber-200"
        >
          Unknown widget: {def.component}
        </div>
      );
  }
}

/** Top-level components are those no other component references as a child. */
function topLevelIds(surface: SurfaceState): string[] {
  const childIds = new Set<string>();
  for (const id of surface.order) {
    for (const childId of surface.components[id]?.children ?? []) {
      childIds.add(childId);
    }
  }
  return surface.order.filter((id) => !childIds.has(id));
}

export function SurfaceRenderer({
  state,
  onAction,
  interactive,
}: {
  state: RendererState;
  onAction: (action: A2UIActionMessage) => void;
  interactive: boolean;
}) {
  return (
    <div className="space-y-6">
      {state.surfaceOrder.map((surfaceId) => {
        const surface = state.surfaces[surfaceId];
        if (!surface) return null;
        const ctx: NodeContext = {
          surfaceId,
          resolve: (id) => surface.components[id],
          onAction,
          interactive,
        };
        return (
          <div key={surfaceId} className="space-y-4">
            {topLevelIds(surface).map((id) => renderNode(id, ctx))}
          </div>
        );
      })}
    </div>
  );
}
