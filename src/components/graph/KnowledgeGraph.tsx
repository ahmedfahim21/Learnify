"use client";

import { useMemo, useState } from "react";
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

import type { KnowledgeGraph as GraphData, KnowledgeNode } from "@/lib/progress";

const NODE_W = 178;
const NODE_H = 62;
const COL_GAP = 90;
const ROW_GAP = 22;

/**
 * Mastery -> colour. Grey means "never assessed", which is a different and
 * more useful signal than "scored zero" — an untouched concept should read as
 * unknown, not as failed.
 */
function masteryColor(score: number | null): string {
  if (score === null) return "#6b7080";
  const hue = 40 + score * 80; // amber -> green
  return `hsl(${hue} 70% 55%)`;
}

function masteryLabel(score: number | null): string {
  if (score === null) return "not assessed";
  return `${Math.round(score * 100)}% mastered`;
}

export function KnowledgeGraphView({ graph }: { graph: GraphData }) {
  const [selected, setSelected] = useState<KnowledgeNode | null>(null);

  // One column per course, concepts stacked in reading order — the layout
  // follows the curriculum rather than a force simulation, so position
  // actually means something.
  const { nodes, edges } = useMemo(() => {
    const byCourse = new Map<string, KnowledgeNode[]>();
    for (const node of graph.nodes) {
      byCourse.set(node.courseTitle, [...(byCourse.get(node.courseTitle) ?? []), node]);
    }

    const flowNodes: Node[] = [];
    let col = 0;
    for (const [courseTitle, courseNodes] of byCourse) {
      flowNodes.push({
        id: `course-${courseTitle}`,
        position: { x: col * (NODE_W + COL_GAP), y: -70 },
        data: { label: courseTitle },
        width: NODE_W,
        height: 40,
        draggable: false,
        selectable: false,
        style: {
          width: NODE_W,
          height: 40,
          background: "#131417",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 0,
          color: "#ededed",
          fontSize: 12,
        },
      });
      courseNodes.forEach((node, row) => {
        flowNodes.push({
          id: node.conceptId,
          position: { x: col * (NODE_W + COL_GAP), y: row * (NODE_H + ROW_GAP) },
          data: { label: node.name },
          width: NODE_W,
          height: NODE_H,
          draggable: false,
          style: {
            width: NODE_W,
            height: NODE_H,
            background: "#101216",
            border: `1px solid ${masteryColor(node.score)}`,
            borderRadius: 0,
            color: "#ededed",
            fontSize: 12,
            padding: 6,
          },
        });
      });
      col += 1;
    }

    const flowEdges: Edge[] = graph.edges.map((edge, i) => ({
      id: `e${i}`,
      source: edge.from,
      target: edge.to,
      type: "smoothstep",
      style: { stroke: "rgba(255,255,255,0.18)", strokeWidth: 1.5 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "rgba(255,255,255,0.18)",
        width: 12,
        height: 12,
      },
    }));

    return { nodes: flowNodes, edges: flowEdges };
  }, [graph]);

  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.conceptId, n])), [graph.nodes]);

  return (
    <div className="space-y-3">
      <div className="h-[560px] w-full border border-(--color-line)">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.2}
          maxZoom={1.5}
          zoomOnScroll={false}
          preventScrolling={false}
          nodesDraggable={false}
          nodesConnectable={false}
          onNodeClick={(_, node) => setSelected(byId.get(node.id) ?? null)}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="rgba(255,255,255,0.06)"
          />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {selected ? (
        <div className="space-y-1 border-l-2 border-(--color-mint) bg-(--color-surface) px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-(--color-fg)">{selected.name}</p>
            <span className="label">{masteryLabel(selected.score)}</span>
          </div>
          <p className="text-sm text-(--color-mist)">{selected.summary}</p>
        </div>
      ) : (
        <p className="label">Click a concept for detail · one column per course</p>
      )}
    </div>
  );
}
