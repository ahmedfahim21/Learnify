"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { DiagramNode } from "@/lib/a2ui/catalog";

import { DIAGRAM_ICON_COMPONENTS } from "./icons";
import { DIAGRAM_NEUTRAL, DIAGRAM_PALETTE } from "./palette";

export interface SystemNodeData extends Record<string, unknown> {
  node: DiagramNode;
  /** The step player has moved past the overview and this node isn't in it. */
  dimmed: boolean;
  active: boolean;
  selected: boolean;
  selectable: boolean;
}

const SHAPE_RADIUS: Record<NonNullable<DiagramNode["shape"]>, string> = {
  box: "rounded-none",
  rounded: "rounded-md",
  pill: "rounded-full",
  cylinder: "rounded-t-lg rounded-b-[1.5rem]",
  hexagon: "rounded-md",
};

/** Handles on all four sides, so `handlePair` can pick the readable one per
 *  edge. They're invisible — React Flow only needs them as anchor points. */
const SIDES = [
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
  { id: "left", position: Position.Left },
] as const;

export function SystemDiagramNode({ data }: NodeProps) {
  const { node, dimmed, active, selected, selectable } = data as SystemNodeData;
  const palette = node.accent ? DIAGRAM_PALETTE[node.accent] : undefined;
  const Icon = node.icon ? DIAGRAM_ICON_COMPONENTS[node.icon] : undefined;

  return (
    <>
      {SIDES.map((side) => (
        <Handle
          key={`t-${side.id}`}
          type="target"
          id={side.id}
          position={side.position}
          isConnectable={false}
          className="!h-px !w-px !min-w-0 !border-0 !bg-transparent"
        />
      ))}
      {SIDES.map((side) => (
        <Handle
          key={`s-${side.id}`}
          type="source"
          id={side.id}
          position={side.position}
          isConnectable={false}
          className="!h-px !w-px !min-w-0 !border-0 !bg-transparent"
        />
      ))}

      <div
        title={node.detail ?? undefined}
        className={`group flex h-full w-full flex-col items-center justify-center gap-1.5 border bg-(--color-node) px-2 text-center transition-all duration-300 ${
          SHAPE_RADIUS[node.shape ?? "rounded"]
        } ${palette?.border ?? DIAGRAM_NEUTRAL.border} ${
          active ? `ring-2 ${palette?.ring ?? "ring-(--color-faint)"} ring-offset-2 ring-offset-(--color-ink)` : ""
        } ${selected ? "ring-2 ring-(--color-fg) ring-offset-2 ring-offset-(--color-ink)" : ""} ${
          dimmed ? "opacity-20 saturate-0" : "opacity-100"
        } ${selectable ? "cursor-pointer hover:border-(--color-faint) hover:bg-(--color-raised)" : "cursor-default"}`}
      >
        {Icon && (
          <Icon
            className={`h-5 w-5 ${palette?.text ?? DIAGRAM_NEUTRAL.text}`}
            strokeWidth={1.75}
          />
        )}
        <span className="text-[13.5px] leading-tight text-(--color-fg)">{node.label}</span>
        {node.sublabel && (
          <span className="text-[11px] leading-tight text-(--color-faint)">{node.sublabel}</span>
        )}
        {node.detail && !dimmed && (
          <span
            aria-hidden
            className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-(--color-faint) transition-colors group-hover:bg-(--color-mist)"
          />
        )}
      </div>
    </>
  );
}

/** A tinted region sitting behind its member nodes. Rendered as a React Flow
 *  node so it pans and zooms with everything else. */
export function SystemDiagramGroupNode({ data }: NodeProps) {
  const { label, color } = data as { label: string; color: keyof typeof DIAGRAM_PALETTE };
  const palette = DIAGRAM_PALETTE[color];
  return (
    <div
      className={`h-full w-full rounded-lg border border-dashed ${palette.groupBorder} ${palette.groupBg}`}
    >
      <span
        className={`absolute -top-2.5 left-3 border border-(--color-line) bg-(--color-ink) px-2 py-0.5 text-[10px] tracking-wide ${palette.groupText}`}
      >
        {label}
      </span>
    </div>
  );
}
