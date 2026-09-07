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
  const progress = steps.length > 0 ? (stepIdx / steps.length) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="h-0.5 w-full overflow-hidden bg-(--color-raised)">
        <div
          className="h-full bg-(--color-signal) transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onStepChange(Math.max(0, stepIdx - 1))}
          disabled={stepIdx === 0}
          aria-label="Previous step"
          className="border border-(--color-line) px-2.5 py-1 text-sm text-(--color-mist) transition-colors hover:border-(--color-faint) hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
        >
          ←
        </button>
        <button
          type="button"
          onClick={onTogglePlay}
          className="border border-(--color-line) bg-(--color-raised) px-3 py-1 text-sm text-(--color-fg) transition-colors hover:border-(--color-faint) hover:bg-(--color-raised) hover:text-white"
        >
          {playing ? "Pause" : stepIdx === steps.length ? "Replay" : "Play"}
        </button>
        <button
          type="button"
          onClick={() => onStepChange(Math.min(steps.length, stepIdx + 1))}
          disabled={stepIdx === steps.length}
          aria-label="Next step"
          className="border border-(--color-line) px-2.5 py-1 text-sm text-(--color-mist) transition-colors hover:border-(--color-faint) hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
        >
          →
        </button>
        <span className="label">
          {stepIdx === 0 ? `${steps.length} steps` : `${stepIdx} / ${steps.length}`}
        </span>
        <div className="ml-auto flex flex-wrap gap-1">
          {steps.map((step) => (
            <button
              key={step.index}
              type="button"
              onClick={() => onStepChange(step.index)}
              aria-label={`Step ${step.index}: ${step.caption}`}
              aria-current={stepIdx === step.index}
              className={`h-1.5 w-5 transition-colors ${
                stepIdx === step.index
                  ? "bg-(--color-signal)"
                  : stepIdx > step.index
                    ? "bg-white/40 hover:bg-white/60"
                    : "bg-white/12 hover:bg-white/30"
              }`}
            />
          ))}
        </div>
      </div>

      <div
        aria-live="polite"
        className="flex min-h-[2.75rem] items-center gap-3 border border-(--color-line) bg-(--color-raised) px-3 py-2"
      >
        {active && (
          <span className="label shrink-0 text-(--color-signal)">
            {String(active.index).padStart(2, "0")}
          </span>
        )}
        <p className="text-sm text-(--color-mist)">
          {active
            ? active.caption
            : "Play the walkthrough, or step through one request at a time."}
        </p>
      </div>
    </div>
  );
}
