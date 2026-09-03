"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
const AUTOPLAY_STEP_MS = 4200;

export function SystemDiagram({ def, ctx }: { def: ComponentDef; ctx: NodeContext }) {
  const props = def.properties as unknown as SystemDiagramProps;
  const layout = useMemo(() => layoutSystemDiagram(props), [props]);
  const reducedMotion = useReducedMotion();

  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(Boolean(props.autoplay) && !reducedMotion);
  const [scale, setScale] = useState(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<HTMLElement>(null);
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

  const goToStep = useCallback((idx: number) => {
    setPlaying(false);
    setSelectedNodeId(null);
    setStepIdx(idx);
  }, []);

  // Arrow keys walk the steps whenever the diagram has focus — the whole
  // walkthrough is usable without a mouse, and without motion.
  useEffect(() => {
    const el = figureRef.current;
    if (!el || steps.length === 0) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setStepIdx((i) => Math.min(steps.length, i + 1));
        setPlaying(false);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setStepIdx((i) => Math.max(0, i - 1));
        setPlaying(false);
      } else if (event.key === "Escape") {
        setSelectedNodeId(null);
      }
    }
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [steps.length]);

  const activeStep = stepIdx > 0 ? steps.find((s) => s.index === stepIdx) : undefined;
  const hasActiveStep = Boolean(activeStep);
  const activeNodeIds = new Set(activeStep?.nodeIds ?? []);
  const activeEdgeIds = new Set(activeStep?.edgeIds ?? []);

  const edgeAccentById = new Map<string, DiagramColor | undefined>();
  for (const laid of layout.edges) {
    edgeAccentById.set(laid.id, layout.nodesById.get(laid.edge.from)?.node.accent);
  }

  const selectedNode = selectedNodeId ? layout.nodesById.get(selectedNodeId)?.node : undefined;
  // A node is worth selecting if it can say something (detail) or if the
  // surface is live and a click means something to the tutor.
  const anyDetail = layout.nodes.some((n) => n.node.detail);
  const selectable = anyDetail || ctx.interactive;

  function handleSelect(nodeId: string, label: string) {
    setSelectedNodeId((current) => (current === nodeId ? null : nodeId));
    if (ctx.interactive) {
      emitAction(ctx, def, "node_click", {
        nodeId,
        label: `Clicked diagram node "${label}"`,
      });
    }
  }

  return (
    <figure
      ref={figureRef}
      tabIndex={steps.length > 0 ? 0 : -1}
      className="space-y-3 rounded-lg border border-white/12 bg-gradient-to-b from-white/[0.04] to-transparent p-4 focus:outline-none focus-visible:ring-1 focus-visible:ring-(--color-mint)"
    >
      {props.title && (
        <figcaption className="flex items-baseline justify-between gap-3">
          <span className="text-white/90">{props.title}</span>
          {selectable && anyDetail && (
            <span className="text-[10px] uppercase tracking-widest text-white/30">
              click a node
            </span>
          )}
        </figcaption>
      )}

      <div ref={containerRef} className="w-full overflow-hidden">
        <div style={{ width: layout.width, height: layout.height * scale }}>
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
                  className={`z-0 rounded-lg border border-dashed ${palette.groupBorder} ${palette.groupBg}`}
                >
                  <span
                    className={`absolute -top-2.5 left-3 border border-white/10 bg-[#0a0a0a] px-2 py-0.5 text-[10px] tracking-wide ${palette.groupText}`}
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
                selected={selectedNodeId === laid.id}
                selectable={selectable}
                onSelect={() => handleSelect(laid.id, laid.node.label)}
              />
            ))}
          </div>
        </div>
      </div>

      {selectedNode && (
        <div className="flex items-start gap-3 border-l-2 border-(--color-mint) bg-white/[0.03] px-3 py-2">
          <div className="flex-1 space-y-0.5">
            <p className="text-xs text-white/80">{selectedNode.label}</p>
            <p className="text-xs leading-relaxed text-white/55">
              {selectedNode.detail ?? "No further detail for this component."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedNodeId(null)}
            aria-label="Close detail"
            className="text-white/30 transition-colors hover:text-white/70"
          >
            ×
          </button>
        </div>
      )}

      {steps.length > 0 && (
        <StepPlayer
          steps={steps}
          stepIdx={stepIdx}
          playing={playing}
          onStepChange={goToStep}
          onTogglePlay={() => {
            if (!playing && stepIdx === steps.length) setStepIdx(0);
            setSelectedNodeId(null);
            setPlaying((p) => !p);
          }}
        />
      )}

      {props.caption && <p className="text-xs text-white/45">{asString(props.caption)}</p>}
    </figure>
  );
}
