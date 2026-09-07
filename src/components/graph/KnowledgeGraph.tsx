"use client";

import { useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { SKILL_TAG_ACCENT, SKILL_TAG_LABELS, type SkillTag } from "@/content/systemDesign/tags";
import type { KnowledgeGraph as GraphData, KnowledgeNode, SkillState } from "@/lib/progress";

const SKILL_W = 186;
const SKILL_H = 54;
const HUB_W = 150;
const HUB_H = 46;
/** Horizontal distance from a hub to its spokes. */
const SPOKE_X = 300;
const ROW_GAP = 12;
/** Vertical breathing room between one theme's cluster and the next. */
const CLUSTER_GAP = 56;

/**
 * State -> colour. Three distinct states rather than a continuous ramp,
 * because "I have read this but never been tested on it" is a genuinely
 * different thing from "I scored badly", and a gradient blurs them together.
 */
const STATE_COLOR: Record<SkillState, string> = {
  read: "var(--color-faint)",
  practised: "var(--color-warn)",
  mastered: "var(--color-deep)",
  unseen: "var(--color-line)",
};

type SkillData = { node: KnowledgeNode };
type HubData = { tag: SkillTag; count: number; concepts: number };

function SkillNode({ data }: NodeProps & { data: SkillData }) {
  const { node } = data;
  return (
    <div
      className="flex h-full flex-col justify-center gap-0.5 border bg-(--color-node) px-3 py-2"
      style={{ borderColor: STATE_COLOR[node.state], width: SKILL_W, height: SKILL_H }}
    >
      <span className="truncate text-[13px] leading-tight text-(--color-fg)">{node.name}</span>
      <span className="label truncate text-[10px]">{node.courseTitle}</span>
      {/* One handle per side so an edge leaves by the shorter route; React Flow
          needs both declared even though only one is ever referenced. */}
      <Handle type="source" position={Position.Right} id="right" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left} id="left" style={{ opacity: 0 }} />
    </div>
  );
}

function HubNode({ data }: NodeProps & { data: HubData }) {
  const accent = `var(--color-${SKILL_TAG_ACCENT[data.tag]})`;
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-0.5 bg-(--color-node) px-3"
      style={{ border: `1px solid ${accent}`, width: HUB_W, height: HUB_H }}
    >
      <span className="text-[13px] leading-none" style={{ color: accent }}>
        {SKILL_TAG_LABELS[data.tag]}
      </span>
      <span className="label text-[10px]">
        {data.count} skills · {data.concepts} concepts
      </span>
      <Handle type="target" position={Position.Left} id="left" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Right} id="right" style={{ opacity: 0 }} />
    </div>
  );
}

const NODE_TYPES = { skill: SkillNode, hub: HubNode };

export function KnowledgeGraphView({ graph }: { graph: GraphData }) {
  const [selected, setSelected] = useState<KnowledgeNode | null>(null);

  const { nodes, edges } = useMemo(() => {
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));

    // Each theme is a hub with its skills stacked beside it. A skill under two
    // themes is placed once, under the first, and keeps its edge to the other —
    // those long edges crossing the canvas are the whole point of the view.
    const placed = new Set<string>();
    const flowNodes: Node[] = [];
    const positions = new Map<string, { x: number; y: number }>();
    let y = 0;

    graph.tags.forEach((entry, i) => {
      const side = i % 2 === 0 ? "right" : "left";
      const own = entry.skillIds.filter((id) => !placed.has(id));
      own.forEach((id) => placed.add(id));

      const stackH = Math.max(own.length, 1) * (SKILL_H + ROW_GAP) - ROW_GAP;
      const hubY = y + stackH / 2 - HUB_H / 2;

      flowNodes.push({
        id: `tag:${entry.tag}`,
        type: "hub",
        position: { x: 0, y: hubY },
        data: { tag: entry.tag, count: entry.skillIds.length, concepts: entry.conceptCount },
        width: HUB_W,
        height: HUB_H,
        draggable: false,
      });
      positions.set(`tag:${entry.tag}`, { x: 0, y: hubY });

      own.forEach((id, row) => {
        const node = byId.get(id);
        if (!node) return;
        const x = side === "right" ? SPOKE_X : -SPOKE_X;
        const ny = y + row * (SKILL_H + ROW_GAP);
        flowNodes.push({
          id,
          type: "skill",
          position: { x, y: ny },
          data: { node },
          width: SKILL_W,
          height: SKILL_H,
          draggable: false,
        });
        positions.set(id, { x, y: ny });
      });

      y += stackH + CLUSTER_GAP;
    });

    const flowEdges: Edge[] = graph.edges.flatMap((edge, i) => {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to) return [];
      const tag = edge.to.slice("tag:".length) as SkillTag;
      const accent = `var(--color-${SKILL_TAG_ACCENT[tag]})`;
      // The skill sits on one side of the hub; leave by the handle facing it.
      const skillSide = from.x < to.x ? "right" : "left";
      return [
        {
          id: `e${i}`,
          source: edge.from,
          target: edge.to,
          sourceHandle: skillSide,
          targetHandle: skillSide === "right" ? "left" : "right",
          type: "bezier",
          style: { stroke: accent, strokeWidth: 1.25, opacity: 0.45 },
        },
      ];
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [graph]);

  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);

  return (
    <div className="space-y-3">
      <div className="h-[560px] w-full border border-(--color-line)">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.15}
          maxZoom={1.5}
          zoomOnScroll={false}
          preventScrolling={false}
          nodesDraggable={false}
          nodesConnectable={false}
          proOptions={{ hideAttribution: false }}
          onNodeClick={(_, node) => setSelected(byId.get(node.id) ?? null)}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--color-line)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {selected ? (
        <div className="space-y-1 border-l-2 border-(--color-signal) bg-(--color-surface) px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-(--color-fg)">{selected.name}</p>
            <span className="label">
              {selected.state === "read"
                ? "read, not yet tested"
                : selected.score === null
                  ? selected.state
                  : `${Math.round(selected.score * 100)}% mastered`}
            </span>
          </div>
          <p className="text-sm text-(--color-mist)">{selected.summary}</p>
          <p className="flex flex-wrap gap-1.5 pt-1">
            {selected.tags.map((tag) => (
              <span
                key={tag}
                className="label text-[10px]"
                style={{ color: `var(--color-${SKILL_TAG_ACCENT[tag]})` }}
              >
                {SKILL_TAG_LABELS[tag]}
              </span>
            ))}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          {(["read", "practised", "mastered"] as const).map((state) => (
            <span key={state} className="label flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 border" style={{ borderColor: STATE_COLOR[state] }} />
              {state}
            </span>
          ))}
          <span className="label">
            · lines join skills that teach the same idea · click one for detail
          </span>
        </div>
      )}
    </div>
  );
}
