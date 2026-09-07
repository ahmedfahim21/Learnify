"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { DiagramColor, SystemDiagramProps } from "@/lib/a2ui/catalog";
import { handlePair, layoutSystemDiagram } from "@/lib/a2ui/diagram";
import type { ComponentDef } from "@/lib/a2ui/messages";

import { asString, emitAction, type NodeContext } from "../rendererContext";
import { DIAGRAM_PALETTE } from "./palette";
import { StepPlayer } from "./StepPlayer";
import { SystemDiagramEdge } from "./SystemDiagramEdge";
import { SystemDiagramGroupNode, SystemDiagramNode } from "./SystemDiagramNode";
import { useReducedMotion } from "./useReducedMotion";

const AUTOPLAY_STEP_MS = 4200;

const NODE_TYPES = { systemNode: SystemDiagramNode, systemGroup: SystemDiagramGroupNode };
const EDGE_TYPES = { systemEdge: SystemDiagramEdge };

/** Stroke for an edge, by the accent of the node it leaves. */
function edgeStroke(accent: DiagramColor | undefined, active: boolean, dimmed: boolean): string {
  if (dimmed) return "rgba(255,255,255,0.10)";
  if (!active) return "rgba(255,255,255,0.35)";
  return accent ? DIAGRAM_PALETTE[accent].stroke : "#4fc9b8";
}

export function SystemDiagram({ def, ctx }: { def: ComponentDef; ctx: NodeContext }) {
  const props = def.properties as unknown as SystemDiagramProps;
  const layout = useMemo(() => layoutSystemDiagram(props), [props]);
  const reducedMotion = useReducedMotion();

  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(Boolean(props.autoplay) && !reducedMotion);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const steps = useMemo(() => props.steps ?? [], [props.steps]);
  const activeStep = stepIdx > 0 ? steps.find((s) => s.index === stepIdx) : undefined;
  const hasActiveStep = Boolean(activeStep);

  useEffect(() => {
    if (!playing || steps.length === 0) return;
    const timer = setTimeout(() => {
      setStepIdx((idx) => {
        if (idx + 1 > steps.length) {
          setPlaying(false);
          return idx;
        }
        return idx + 1;
      });
    }, AUTOPLAY_STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, stepIdx, steps.length]);

  const goToStep = useCallback((idx: number) => {
    setPlaying(false);
    setSelectedNodeId(null);
    setStepIdx(idx);
  }, []);

  const anyDetail = layout.nodes.some((n) => n.node.detail);
  const selectable = anyDetail || ctx.interactive;

  const flowNodes = useMemo<Node[]>(() => {
    const activeIds = new Set(activeStep?.nodeIds ?? []);
    // Groups first so they paint behind their members.
    const groupNodes: Node[] = layout.groups.map((g) => ({
      id: `group-${g.id}`,
      type: "systemGroup",
      position: { x: g.x, y: g.y },
      data: { label: g.group.label, color: g.group.color },
      width: g.w,
      height: g.h,
      style: { width: g.w, height: g.h },
      selectable: false,
      draggable: false,
      zIndex: 0,
    }));
    const boxes: Node[] = layout.nodes.map((laid) => ({
      id: laid.id,
      type: "systemNode",
      position: { x: laid.x, y: laid.y },
      width: laid.w,
      height: laid.h,
      style: { width: laid.w, height: laid.h },
      data: {
        node: laid.node,
        dimmed: hasActiveStep && !activeIds.has(laid.id),
        active: hasActiveStep && activeIds.has(laid.id),
        selected: selectedNodeId === laid.id,
        selectable,
      },
      selectable,
      draggable: false,
      zIndex: 1,
    }));
    return [...groupNodes, ...boxes];
  }, [layout, activeStep, hasActiveStep, selectedNodeId, selectable]);

  const flowEdges = useMemo<Edge[]>(() => {
    const activeIds = new Set(activeStep?.edgeIds ?? []);
    return props.edges.map((edge) => {
      const from = layout.nodesById.get(edge.from)?.node;
      const to = layout.nodesById.get(edge.to)?.node;
      const handles = from && to ? handlePair(from, to, edge.route) : undefined;
      const active = hasActiveStep && activeIds.has(edge.id);
      const dimmed = hasActiveStep && !active;
      const stroke = edgeStroke(from?.accent, active, dimmed);
      return {
        id: edge.id,
        source: edge.from,
        target: edge.to,
        sourceHandle: handles?.source,
        targetHandle: handles?.target,
        // smoothstep is React Flow's orthogonal, rounded-corner router — the
        // ByteByteGo look, without hand-rolling path geometry.
        type: "systemEdge",
        // Marching ants on the step being explained, in place of the old
        // custom motion-path packet (and its Safari fallback).
        animated: active && !reducedMotion,
        // Badge, label and stroke go to the custom edge as separate fields
        // rather than one concatenated text label — see SystemDiagramEdge.
        data: { step: edge.step, label: edge.label, stroke, active, dimmed },
        style: { strokeDasharray: edge.style === "dashed" ? "6 4" : undefined },
        markerEnd:
          edge.arrow === "none"
            ? undefined
            : { type: MarkerType.ArrowClosed, color: stroke, width: 16, height: 16 },
        zIndex: 2,
      };
    });
  }, [props.edges, layout, activeStep, hasActiveStep, reducedMotion]);

  const selectedNode = selectedNodeId ? layout.nodesById.get(selectedNodeId)?.node : undefined;

  return (
    <figure className="space-y-3 border border-(--color-line) bg-gradient-to-b from-white/[0.04] to-transparent p-4">
      {props.title && (
        <figcaption className="flex items-baseline justify-between gap-3">
          <span className="text-(--color-fg)">{props.title}</span>
          {selectable && anyDetail && (
            <span className="text-[10px] uppercase tracking-widest text-(--color-faint)">click a node</span>
          )}
        </figcaption>
      )}

      <div style={{ height: Math.min(layout.height + 40, 520) }} className="w-full">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.3}
          maxZoom={1.75}
          // A diagram, not an editor — and scrolling the page over it must
          // never zoom it, which is the default that annoys everyone.
          zoomOnScroll={false}
          preventScrolling={false}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          panOnDrag
          onNodeClick={(_, node) => {
            if (node.type !== "systemNode") return;
            setSelectedNodeId((current) => (current === node.id ? null : node.id));
            if (ctx.interactive) {
              const label = layout.nodesById.get(node.id)?.node.label ?? node.id;
              emitAction(ctx, def, "node_click", {
                nodeId: node.id,
                label: `Clicked diagram node "${label}"`,
              });
            }
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgba(255,255,255,0.07)" />
          <Controls showInteractive={false} className="!border-(--color-line) !bg-[#101216] !shadow-none" />
        </ReactFlow>
      </div>

      {selectedNode && (
        <div className="flex items-start gap-3 border-l-2 border-(--color-mint) bg-(--color-raised) px-3 py-2">
          <div className="flex-1 space-y-0.5">
            <p className="text-xs text-(--color-fg)">{selectedNode.label}</p>
            <p className="text-xs leading-relaxed text-(--color-mist)">
              {selectedNode.detail ?? "No further detail for this component."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedNodeId(null)}
            aria-label="Close detail"
            className="text-(--color-faint) transition-colors hover:text-(--color-mist)"
          >
            ×
          </button>
        </div>
      )}

      {steps.length > 0 && (
        <StepPlayer
          steps={steps}
          stepIdx={stepIdx}
          playing={playing}
          onStepChange={goToStep}
          onTogglePlay={() => {
            if (!playing && stepIdx === steps.length) setStepIdx(0);
            setSelectedNodeId(null);
            setPlaying((p) => !p);
          }}
        />
      )}

      {props.caption && <p className="text-xs text-(--color-faint)">{asString(props.caption)}</p>}
    </figure>
  );
}
