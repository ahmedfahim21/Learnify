"use client";

import type { DiagramStep } from "@/lib/a2ui/catalog";

export function StepPlayer({
  steps,
  stepIdx,
  playing,
  onStepChange,
  onTogglePlay,
}: {
  steps: DiagramStep[];
  /** 0 = overview (nothing dimmed), 1..N = the active step. */
  stepIdx: number;
  playing: boolean;
  onStepChange: (idx: number) => void;
  onTogglePlay: () => void;
}) {
  const active = stepIdx > 0 ? steps.find((s) => s.index === stepIdx) : undefined;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onStepChange(Math.max(0, stepIdx - 1))}
          disabled={stepIdx === 0}
          aria-label="Previous step"
          className="rounded-lg border border-white/15 px-2.5 py-1.5 text-sm hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-30"
        >
          ←
        </button>
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className="rounded-lg border border-white/20 bg-white/[0.04] px-3 py-1.5 text-sm hover:border-white/40 hover:bg-white/[0.08]"
        >
          {playing ? "⏸ Pause" : "▶ Play"}
        </button>
        <button
          type="button"
          onClick={() => onStepChange(Math.min(steps.length, stepIdx + 1))}
          disabled={stepIdx === steps.length}
          aria-label="Next step"
          className="rounded-lg border border-white/15 px-2.5 py-1.5 text-sm hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-30"
        >
          →
        </button>
        <span className="text-xs text-white/40">
          {stepIdx === 0 ? `Overview · ${steps.length} steps` : `Step ${stepIdx} / ${steps.length}`}
        </span>
        <div className="ml-auto flex flex-wrap gap-1">
          {steps.map((step) => (
            <button
              key={step.index}
              type="button"
              onClick={() => onStepChange(step.index)}
              aria-label={`Go to step ${step.index}`}
              aria-current={stepIdx === step.index}
              className={`h-2 w-6 rounded-full transition-colors ${
                stepIdx === step.index ? "bg-white/80" : "bg-white/15 hover:bg-white/30"
              }`}
            />
          ))}
        </div>
      </div>
      <div
        aria-live="polite"
        className="min-h-[2.5rem] rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80"
      >
        {active ? active.caption : "Play through the numbered steps to see the request flow."}
      </div>
    </div>
  );
}
