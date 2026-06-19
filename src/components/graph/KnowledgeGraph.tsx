"use client";

import { useMemo } from "react";
import dagre from "dagre";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

/**
 * Knowledge-graph view of a topic's prerequisite DAG (#42).
 *
 * Concepts are laid out top-down with dagre (prerequisites above dependents)
 * and coloured by mastery — grey when not started, ramping to green as the
 * mastery engine (#43) fills it in. Clicking a node toggles it for a targeted
 * session.
 */

export interface GraphConcept {
  id: string;
  slug: string;
  name: string;
  summary: string;
  difficulty: number;
  mastery: number;
}

export interface GraphEdge {
  /** concept id */
  from: string;
  /** concept id */
  to: string;
}

const NODE_WIDTH = 200;
const NODE_HEIGHT = 76;

/** Grey for not-started, then amber→green as mastery climbs 0→1. */
function masteryColor(mastery: number): { bg: string; border: string } {
  if (mastery <= 0) return { bg: "rgba(148,163,184,0.10)", border: "rgba(148,163,184,0.35)" };
  const hue = 40 + 80 * Math.min(1, mastery); // 40 (amber) → 120 (green)
  return {
    bg: `hsla(${hue}, 60%, 45%, 0.18)`,
    border: `hsla(${hue}, 65%, 55%, 0.65)`,
  };
}

interface ConceptNodeData extends Record<string, unknown> {
  concept: GraphConcept;
  selected: boolean;
}

function ConceptNodeView({ data }: NodeProps) {
  const { concept, selected } = data as ConceptNodeData;
  const { bg, border } = masteryColor(concept.mastery);
  const pct = Math.round(Math.min(1, Math.max(0, concept.mastery)) * 100);
  return (
    <div
      title={concept.summary}
      style={{ width: NODE_WIDTH, background: bg, borderColor: selected ? "#fff" : border }}
      className={`rounded-lg border px-3 py-2 text-left shadow-sm transition ${
        selected ? "ring-2 ring-white/70" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-white/40" />
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-tight text-white">
          {concept.name}
        </span>
        <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">
          L{concept.difficulty}
        </span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-white/70"
          style={{ width: `${pct}%` }}
        />
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-white/40" />
    </div>
  );
}

const nodeTypes = { concept: ConceptNodeView };

/** Run dagre and return positioned nodes + edges for React Flow. */
function layout(
  graphConcepts: GraphConcept[],
  graphEdges: GraphEdge[],
  selectedIds: Set<string>,
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 70 });

  for (const c of graphConcepts) {
    g.setNode(c.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const e of graphEdges) {
    if (g.hasNode(e.from) && g.hasNode(e.to)) g.setEdge(e.from, e.to);
  }
  dagre.layout(g);

  const nodes: Node[] = graphConcepts.map((c) => {
    const pos = g.node(c.id);
    return {
      id: c.id,
      type: "concept",
      position: { x: (pos?.x ?? 0) - NODE_WIDTH / 2, y: (pos?.y ?? 0) - NODE_HEIGHT / 2 },
      data: { concept: c, selected: selectedIds.has(c.id) } satisfies ConceptNodeData,
    };
  });

  const edges: Edge[] = graphEdges.map((e, i) => ({
    id: `e${i}`,
    source: e.from,
    target: e.to,
    markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(255,255,255,0.4)" },
    style: { stroke: "rgba(255,255,255,0.25)" },
  }));

  return { nodes, edges };
}

export function KnowledgeGraph({
  concepts,
  edges,
  selectedIds,
  onToggle,
}: {
  concepts: GraphConcept[];
  edges: GraphEdge[];
  selectedIds: Set<string>;
  onToggle?: (conceptId: string) => void;
}) {
  const { nodes, edges: flowEdges } = useMemo(
    () => layout(concepts, edges, selectedIds),
    [concepts, edges, selectedIds],
  );

  return (
    <div className="h-[28rem] w-full overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={Boolean(onToggle)}
        onNodeClick={(_, node) => onToggle?.(node.id)}
      >
        <Background color="rgba(255,255,255,0.06)" gap={20} />
        <Controls showInteractive={false} className="!border-white/10 !bg-black/40" />
      </ReactFlow>
    </div>
  );
}
