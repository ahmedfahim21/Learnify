"use client";

import { useMemo, useState } from "react";

import {
  modRemappedFraction,
  remappedFraction,
  simulateConsistentHashing,
} from "@/lib/sims/math/consistentHash";
import type { SimulatorSpec } from "@/lib/sims/types";

import { SimBars, SimSlider, SimStat, formatNumber } from "../controls";

const SIZE = 260;
const CENTER = SIZE / 2;
const RADIUS = 96;

const NODE_COLORS = ["#6e9bee", "#4fc9b8", "#f9a85c", "#a585e0", "#f286b4", "#f26d6d", "#22d3ee", "#fbbf24"];

const nodeName = (i: number) => `node-${String.fromCharCode(65 + i)}`;
const nodeLabel = (id: string) => id.replace("node-", "Node ");

/** Position on the ring for a 0..1 hash value — 0 at 12 o'clock, clockwise.
 *
 *  Coordinates are : Math.sin/cos are only specified to within the
 *  last ULP, so Node (SSR) and the browser can differ in the final digit,
 *  and React reads that as a hydration mismatch. Two decimals is far below
 *  one pixel on a 260px canvas. */
function ringPoint(unit: number, radius = RADIUS) {
  const angle = unit * Math.PI * 2 - Math.PI / 2;
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    x: round(CENTER + Math.cos(angle) * radius),
    y: round(CENTER + Math.sin(angle) * radius),
  };
}

export function ConsistentHashingSim({
  spec,
  initial,
}: {
  spec: SimulatorSpec;
  initial: Record<string, number | boolean>;
}) {
  const [nodeCount, setNodeCount] = useState(Number(initial.nodeCount));
  const [virtualNodes, setVirtualNodes] = useState(Number(initial.virtualNodesPerNode));
  const keyCount = Number(initial.keyCount);

  const nodeIds = useMemo(
    () => Array.from({ length: nodeCount }, (_, i) => nodeName(i)),
    [nodeCount],
  );

  const result = useMemo(
    () => simulateConsistentHashing({ nodeIds, virtualNodesPerNode: virtualNodes, keyCount }),
    [nodeIds, virtualNodes, keyCount],
  );

  // What *would* happen if we added one more node: the ring's headline claim.
  const ringRemap = useMemo(
    () => remappedFraction(nodeIds, [...nodeIds, nodeName(nodeCount)], virtualNodes, 2000),
    [nodeIds, nodeCount, virtualNodes],
  );
  const modRemap = useMemo(
    () => modRemappedFraction(nodeCount, nodeCount + 1, 2000),
    [nodeCount],
  );

  const colorOf = (id: string) => NODE_COLORS[nodeIds.indexOf(id) % NODE_COLORS.length];
  const specOf = (key: string) => spec.params.find((p) => p.key === key)!;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <SimSlider spec={specOf("nodeCount")} value={nodeCount} onChange={setNodeCount} />
        <SimSlider spec={specOf("virtualNodesPerNode")} value={virtualNodes} onChange={setVirtualNodes} />
      </div>

      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-[260px]" role="img" aria-label="Consistent hashing ring">
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
          {/* Each virtual node as a tick on the ring, coloured by its physical node. */}
          {result.ring.flatMap((node) =>
            node.positions.map((pos, i) => {
              const outer = ringPoint(pos, RADIUS + 7);
              const inner = ringPoint(pos, RADIUS - 7);
              return (
                <line
                  key={`${node.id}-${i}`}
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke={colorOf(node.id)}
                  strokeWidth={virtualNodes > 40 ? 1 : 2}
                  opacity={virtualNodes > 40 ? 0.5 : 0.9}
                />
              );
            }),
          )}
          {/* One labelled marker per physical node, at its first virtual position. */}
          {result.ring.map((node) => {
            const at = ringPoint(node.positions[0], RADIUS + 22);
            return (
              <text
                key={node.id}
                x={at.x}
                y={at.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={9}
                fill={colorOf(node.id)}
              >
                {nodeLabel(node.id).replace("Node ", "")}
              </text>
            );
          })}
          <text x={CENTER} y={CENTER - 6} textAnchor="middle" fontSize={11} fill="rgba(255,255,255,0.75)">
            {nodeCount} nodes
          </text>
          <text x={CENTER} y={CENTER + 10} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.4)">
            {virtualNodes} vnodes each
          </text>
        </svg>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <SimStat
              label="Remapped: ring"
              value={`${(ringRemap * 100).toFixed(1)}%`}
              hint={`ideal 1/N = ${((1 / (nodeCount + 1)) * 100).toFixed(1)}%`}
            />
            <SimStat
              label="Remapped: modulo"
              value={`${(modRemap * 100).toFixed(1)}%`}
              hint="hash(key) % N, for contrast"
            />
          </div>
          <SimStat
            label="Key-share spread"
            value={`±${(result.shareStdDev * 100).toFixed(2)}%`}
            hint="std dev across nodes — lower is more even"
          />
        </div>
      </div>

      <SimBars
        bars={nodeIds.map((id) => ({ label: nodeLabel(id), value: (result.keyShare[id] ?? 0) * 100 }))}
        formatValue={(v) => `${formatNumber(v)}%`}
      />
    </div>
  );
}
