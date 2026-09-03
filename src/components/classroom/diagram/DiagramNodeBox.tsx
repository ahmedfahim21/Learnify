"use client";

import type { LaidOutNode } from "@/lib/a2ui/diagram";

import { DIAGRAM_ICON_COMPONENTS } from "./icons";
import { DIAGRAM_NEUTRAL, DIAGRAM_PALETTE } from "./palette";

const SHAPE_RADIUS: Record<NonNullable<LaidOutNode["node"]["shape"]>, string> = {
  box: "rounded-md",
  rounded: "rounded-xl",
  pill: "rounded-full",
  cylinder: "rounded-t-xl rounded-b-[2rem]",
  hexagon: "rounded-lg",
};

export function DiagramNodeBox({
  laid,
  dimmed,
  active,
  interactive,
  onClick,
}: {
  laid: LaidOutNode;
  /** True once the step player has moved past the overview frame and this
   *  node isn't part of the active step. */
  dimmed: boolean;
  active: boolean;
  interactive: boolean;
  onClick: () => void;
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
      disabled={!interactive}
      onClick={onClick}
      style={{
        position: "absolute",
        left: laid.x,
        top: laid.y,
        width: laid.w,
        height: laid.h,
      }}
      className={`z-20 flex flex-col items-center justify-center gap-1.5 border bg-[#101010] px-2 text-center shadow-sm transition-all duration-300 ${radius} ${border} ${
        active ? `ring-2 ${palette?.ring ?? "ring-white/60"} ring-offset-2 ring-offset-[#0a0a0a]` : ""
      } ${dimmed ? "opacity-25 saturate-0" : "opacity-100"} ${
        interactive ? "cursor-pointer hover:border-white/50" : "cursor-default"
      } disabled:cursor-default`}
    >
      {Icon && <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={1.75} />}
      <span className="text-xs leading-tight font-medium text-white/90">{node.label}</span>
      {node.sublabel && (
        <span className="text-[10px] leading-tight text-white/45">{node.sublabel}</span>
      )}
    </button>
  );
}
