"use client";

import type { LaidOutEdge } from "@/lib/a2ui/diagram";

import type { DiagramColor } from "@/lib/a2ui/catalog";

import { DIAGRAM_NEUTRAL, DIAGRAM_PALETTE } from "./palette";

/** Set once per page load; `offset-path` motion needs Safari 16+. */
let offsetPathSupport: boolean | null = null;
function supportsOffsetPath(): boolean {
  if (offsetPathSupport !== null) return offsetPathSupport;
  offsetPathSupport =
    typeof CSS !== "undefined" && CSS.supports?.("offset-path", 'path("M0 0")');
  return offsetPathSupport;
}

export function DiagramEdgeLayer({
  width,
  height,
  edges,
  activeEdgeIds,
  hasActiveStep,
  accentColorOf,
  reducedMotion,
}: {
  width: number;
  height: number;
  edges: LaidOutEdge[];
  activeEdgeIds: Set<string>;
  hasActiveStep: boolean;
  accentColorOf: (edgeId: string) => DiagramColor | undefined;
  reducedMotion: boolean;
}) {
  const canAnimatePacket = supportsOffsetPath() && !reducedMotion;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <marker
          id="a2ui-arrow-dim"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="rgba(255,255,255,0.35)" />
        </marker>
        {Object.entries(DIAGRAM_PALETTE).map(([name, entry]) => (
          <marker
            key={name}
            id={`a2ui-arrow-${name}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse"
          >
            <path d={"M0,0 L10,5 L0,10 z"} fill={entry.stroke} />
          </marker>
        ))}
      </defs>

      {edges.map((laid) => {
        const active = activeEdgeIds.has(laid.id);
        const dimmed = hasActiveStep && !active;
        const accentName = accentColorOf(laid.id);
        const accent = accentName ? DIAGRAM_PALETTE[accentName] : undefined;
        const stroke = active ? accent?.stroke ?? "#ededed" : DIAGRAM_NEUTRAL.stroke;
        const markerId = active
          ? `a2ui-arrow-${accentName ?? "slate"}`
          : "a2ui-arrow-dim";
        const showArrow = (laid.edge.arrow ?? "forward") !== "none";
        const dashed = laid.edge.style === "dashed" || (dimmed && !active);

        return (
          <g key={laid.id} opacity={dimmed ? 0.25 : 1} style={{ transition: "opacity 300ms" }}>
            <path
              d={laid.d}
              fill="none"
              stroke={stroke}
              strokeWidth={active ? 2.5 : 1.5}
              strokeDasharray={dashed ? "5 4" : undefined}
              markerEnd={showArrow ? `url(#${markerId})` : undefined}
              className={active && !canAnimatePacket ? "a2ui-marching-ants" : undefined}
            />
            {laid.badge && (
              <g transform={`translate(${laid.badge.x}, ${laid.badge.y})`}>
                <circle
                  r={9}
                  fill={active ? stroke : "#1a1a1a"}
                  stroke={active ? "#0a0a0a" : "rgba(255,255,255,0.3)"}
                  strokeWidth={1}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={10}
                  fontWeight={600}
                  fill={active ? "#0a0a0a" : "rgba(255,255,255,0.6)"}
                >
                  {laid.edge.step}
                </text>
              </g>
            )}
            {laid.edge.label && laid.labelAt && (
              <text
                x={laid.labelAt.x}
                y={laid.labelAt.y}
                textAnchor="middle"
                fontSize={10}
                fill="rgba(255,255,255,0.55)"
                className="select-none"
              >
                {laid.edge.label}
              </text>
            )}
            {active && canAnimatePacket && (
              <circle r={4} fill={stroke} className="a2ui-packet" style={{ offsetPath: `path("${laid.d}")` }} />
            )}
          </g>
        );
      })}
    </svg>
  );
}
