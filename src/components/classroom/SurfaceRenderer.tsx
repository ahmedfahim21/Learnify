"use client";

import {
  type A2UIActionMessage,
  type A2UIServerMessage,
  type ComponentDef,
} from "@/lib/a2ui/messages";

import { Markdown } from "./Markdown";
import { asString, type NodeContext } from "./rendererContext";
import { CodeSnippet } from "./widgets/CodeSnippet";
import { Diagram } from "./widgets/Diagram";
import { Flashcard } from "./widgets/Flashcard";
import { FreeResponse } from "./widgets/FreeResponse";
import { MatchingPairs } from "./widgets/MatchingPairs";
import { MultipleChoiceCheck } from "./widgets/MultipleChoiceCheck";
import { OrderingExercise } from "./widgets/OrderingExercise";
import { ProgressMeter } from "./widgets/ProgressMeter";
import { SessionRecap } from "./widgets/SessionRecap";
import { SystemDiagram } from "./diagram/SystemDiagram";
import { SimulatorWidget } from "./simulators/SimulatorWidget";

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

function renderNode(id: string, ctx: NodeContext): React.ReactNode {
  const def = ctx.resolve(id);
  if (!def) return null;

  switch (def.component) {
    case "Narration":
      return (
        <div key={id} className="text-(--color-fg)">
          <Markdown text={asString(def.properties.text)} />
        </div>
      );

    case "ExplanationCard": {
      const emoji = asString(def.properties.emoji);
      return (
        <div
          key={id}
          className="space-y-2 border border-(--color-line) bg-(--color-raised) p-4"
        >
          <h3 className="text-lg">
            {emoji ? `${emoji} ` : ""}
            {asString(def.properties.title)}
          </h3>
          <div className="text-(--color-fg)">
            <Markdown text={asString(def.properties.body)} />
          </div>
        </div>
      );
    }

    case "MultipleChoiceCheck":
      return <MultipleChoiceCheck key={id} def={def} ctx={ctx} />;

    case "Flashcard":
      return <Flashcard key={id} def={def} ctx={ctx} />;

    case "OrderingExercise":
      return <OrderingExercise key={id} def={def} ctx={ctx} />;

    case "MatchingPairs":
      return <MatchingPairs key={id} def={def} ctx={ctx} />;

    case "CodeSnippet":
      return <CodeSnippet key={id} def={def} />;

    case "Diagram":
      return <Diagram key={id} def={def} ctx={ctx} />;

    case "SystemDiagram":
      return <SystemDiagram key={id} def={def} ctx={ctx} />;

    case "Simulator":
      return <SimulatorWidget key={id} def={def} />;

    case "FreeResponse":
      return <FreeResponse key={id} def={def} ctx={ctx} />;

    case "ProgressMeter":
      return <ProgressMeter key={id} def={def} />;

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
          className="border border-(--color-mango)/40 bg-(--color-mango)/10 p-2 text-xs text-(--color-mango)"
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
