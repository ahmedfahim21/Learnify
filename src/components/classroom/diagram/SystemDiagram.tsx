"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { ComponentDef } from "@/lib/a2ui/messages";
import { layoutSystemDiagram } from "@/lib/a2ui/diagram";
import type { DiagramColor, SystemDiagramProps } from "@/lib/a2ui/catalog";

import { asString, emitAction, type NodeContext } from "../rendererContext";
import { DiagramEdgeLayer } from "./DiagramEdgeLayer";
import { DiagramNodeBox } from "./DiagramNodeBox";
import { DIAGRAM_PALETTE } from "./palette";
import { StepPlayer } from "./StepPlayer";
import { useReducedMotion } from "./useReducedMotion";

/** How long the autoplay walkthrough dwells on each step before advancing. */
const AUTOPLAY_STEP_MS = 3600;

export function SystemDiagram({ def, ctx }: { def: ComponentDef; ctx: NodeContext }) {
  const props = def.properties as unknown as SystemDiagramProps;
  const layout = useMemo(() => layoutSystemDiagram(props), [props]);
  const reducedMotion = useReducedMotion();

  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(Boolean(props.autoplay) && !reducedMotion);
  const [scale, setScale] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const steps = props.steps ?? [];

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const availableWidth = entry.contentRect.width;
      setScale(availableWidth > 0 ? Math.min(1, availableWidth / layout.width) : 1);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [layout.width]);

  useEffect(() => {
    if (!playing || steps.length === 0) return;
    const timer = setTimeout(() => {
      setStepIdx((idx) => {
        const next = idx + 1;
        if (next > steps.length) {
          setPlaying(false);
          return idx;
        }
        return next;
      });
    }, AUTOPLAY_STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, stepIdx, steps.length]);

  const activeStep = stepIdx > 0 ? steps.find((s) => s.index === stepIdx) : undefined;
  const hasActiveStep = Boolean(activeStep);
  const activeNodeIds = new Set(activeStep?.nodeIds ?? []);
  const activeEdgeIds = new Set(activeStep?.edgeIds ?? []);

  const edgeAccentById = new Map<string, DiagramColor | undefined>();
  for (const laid of layout.edges) {
    const fromAccent = layout.nodesById.get(laid.edge.from)?.node.accent;
    edgeAccentById.set(laid.id, fromAccent);
  }

  const handleStepChange = (idx: number) => {
    setPlaying(false);
    setStepIdx(idx);
  };

  return (
    <figure className="space-y-3 rounded-xl border border-white/15 bg-white/[0.03] p-4">
      {props.title && <figcaption className="font-medium text-white/90">{props.title}</figcaption>}
      <div ref={containerRef} className="w-full overflow-hidden">
        <div
          style={{
            width: layout.width,
            height: layout.height * scale,
          }}
        >
          <div
            style={{
              width: layout.width,
              height: layout.height,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              position: "relative",
            }}
          >
            {layout.groups.map((g) => {
              const palette = DIAGRAM_PALETTE[g.group.color];
              return (
                <div
                  key={g.id}
                  style={{ position: "absolute", left: g.x, top: g.y, width: g.w, height: g.h }}
                  className={`z-0 rounded-2xl border border-dashed ${palette.groupBorder} ${palette.groupBg}`}
                >
                  <span
                    className={`absolute -top-2.5 left-3 rounded-full border border-white/10 bg-[#0a0a0a] px-2 py-0.5 text-[10px] font-medium tracking-wide ${palette.groupText}`}
                  >
                    {g.group.label}
                  </span>
                </div>
              );
            })}

            <DiagramEdgeLayer
              width={layout.width}
              height={layout.height}
              edges={layout.edges}
              activeEdgeIds={activeEdgeIds}
              hasActiveStep={hasActiveStep}
              accentColorOf={(id) => edgeAccentById.get(id)}
              reducedMotion={reducedMotion}
            />

            {layout.nodes.map((laid) => (
              <DiagramNodeBox
                key={laid.id}
                laid={laid}
                dimmed={hasActiveStep && !activeNodeIds.has(laid.id)}
                active={hasActiveStep && activeNodeIds.has(laid.id)}
                interactive={ctx.interactive}
                onClick={() =>
                  emitAction(ctx, def, "node_click", {
                    nodeId: laid.id,
                    label: `Clicked diagram node "${laid.node.label}"`,
                  })
                }
              />
            ))}
          </div>
        </div>
      </div>

      {steps.length > 0 && (
        <StepPlayer
          steps={steps}
          stepIdx={stepIdx}
          playing={playing}
          onStepChange={handleStepChange}
          onTogglePlay={() => {
            if (!playing && stepIdx === steps.length) setStepIdx(0);
            setPlaying((p) => !p);
          }}
        />
      )}

      {props.caption && <p className="text-xs text-white/50">{asString(props.caption)}</p>}
    </figure>
  );
}
