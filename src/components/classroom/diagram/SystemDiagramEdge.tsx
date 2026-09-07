"use client";

import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

export interface SystemEdgeData extends Record<string, unknown> {
  /** 1-based walkthrough step, drawn as a numbered badge on the path. */
  step?: number;
  /** Short caption for the hop. Long prose belongs in the step player. */
  label?: string;
  stroke: string;
  active: boolean;
  dimmed: boolean;
}

/**
 * A diagram edge: orthogonal path, a numbered badge, and an optional short
 * label — as separate elements rather than one concatenated string.
 *
 * That separation is the point. Packing "3  cache miss -> load from store"
 * into React Flow's built-in `label` renders one wide text run centred on the
 * path, and a column gap is only tens of pixels wide, so anything longer than
 * a couple of words spills across the neighbouring nodes. Here the badge is a
 * fixed-size circle that always fits, the label underneath is width-capped and
 * truncated, and the full sentence lives in the step caption below the canvas.
 */
export function SystemDiagramEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}: EdgeProps) {
  const { step, label, stroke, active, dimmed } = (data ?? {}) as SystemEdgeData;

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  });

  return (
    <>
      <BaseEdge path={path} markerEnd={markerEnd} style={{ stroke, strokeWidth: active ? 2 : 1.5 }} />
      {(step !== undefined || label) && (
        <EdgeLabelRenderer>
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              opacity: dimmed ? 0.3 : 1,
            }}
            className="pointer-events-none absolute flex flex-col items-center gap-1"
          >
            {step !== undefined && (
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px] tabular-nums"
                style={{
                  borderColor: stroke,
                  color: active ? "var(--color-ink)" : stroke,
                  background: active ? stroke : "var(--color-ink)",
                }}
              >
                {step}
              </span>
            )}
            {label && (
              <span className="max-w-[130px] truncate bg-(--color-ink)/90 px-1.5 py-0.5 text-[10px] leading-tight text-(--color-mist)">
                {label}
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
