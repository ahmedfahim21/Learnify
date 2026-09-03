"use client";

import type { LaidOutNode } from "@/lib/a2ui/diagram";

import { DIAGRAM_ICON_COMPONENTS } from "./icons";
import { DIAGRAM_NEUTRAL, DIAGRAM_PALETTE } from "./palette";

const SHAPE_RADIUS: Record<NonNullable<LaidOutNode["node"]["shape"]>, string> = {
  box: "rounded-none",
  rounded: "rounded-md",
  pill: "rounded-full",
  cylinder: "rounded-t-lg rounded-b-[1.5rem]",
  hexagon: "rounded-md",
};

export function DiagramNodeBox({
  laid,
  dimmed,
  active,
  selected,
  selectable,
  onSelect,
}: {
  laid: LaidOutNode;
  /** True once the step player has moved past the overview frame and this
   *  node isn't part of the active step. */
  dimmed: boolean;
  active: boolean;
  selected: boolean;
  /** The node carries detail worth revealing, or the surface accepts clicks. */
  selectable: boolean;
  onSelect: () => void;
}) {
  const { node } = laid;
  const palette = node.accent ? DIAGRAM_PALETTE[node.accent] : undefined;
  const Icon = node.icon ? DIAGRAM_ICON_COMPONENTS[node.icon] : undefined;
  const radius = SHAPE_RADIUS[node.shape ?? "rounded"];
  const border = palette?.border ?? DIAGRAM_NEUTRAL.border;
  const iconColor = palette?.text ?? DIAGRAM_NEUTRAL.text;

  return (
    <button
      type="button"
      disabled={!selectable}
      onClick={onSelect}
      aria-pressed={selected}
      title={node.detail ? node.detail : undefined}
      style={{
        position: "absolute",
        left: laid.x,
        top: laid.y,
        width: laid.w,
        height: laid.h,
      }}
      className={`group z-20 flex flex-col items-center justify-center gap-1.5 border bg-[#101216] px-2 text-center transition-all duration-300 ${radius} ${border} ${
        active
          ? `ring-2 ${palette?.ring ?? "ring-white/60"} ring-offset-2 ring-offset-[#0a0a0a] shadow-lg`
          : ""
      } ${selected ? "ring-2 ring-white/80 ring-offset-2 ring-offset-[#0a0a0a]" : ""} ${
        dimmed ? "opacity-20 saturate-0" : "opacity-100"
      } ${
        selectable
          ? "cursor-pointer hover:border-white/60 hover:bg-[#171a20] hover:-translate-y-0.5"
          : "cursor-default"
      }`}
    >
      {Icon && (
        <Icon
          className={`h-5 w-5 transition-transform duration-200 ${iconColor} ${
            selectable ? "group-hover:scale-110" : ""
          }`}
          strokeWidth={1.75}
        />
      )}
      <span className="text-[11px] leading-tight text-white/90">{node.label}</span>
      {node.sublabel && (
        <span className="text-[9px] leading-tight text-white/40">{node.sublabel}</span>
      )}
      {node.detail && !dimmed && (
        <span
          aria-hidden
          className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-white/30 transition-colors group-hover:bg-white/70"
        />
      )}
    </button>
  );
}
