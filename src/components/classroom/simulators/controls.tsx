"use client";

import type { ParamSpec } from "@/lib/sims/types";

/**
 * Shared control primitives every simulator composes from — one visual
 * language (`[intro] -> [controls grid] -> [output] -> [notice callout]`)
 * across the whole simulator catalog.
 */

export function SimSlider({
  spec,
  value,
  onChange,
}: {
  spec: ParamSpec;
  value: number;
  onChange: (value: number) => void;
}) {
  // A whole-number param (server count, worker count) reads as noise at
  // "5.00" — only show decimals when the step can actually produce them.
  const stepsWhole = (spec.step ?? 1) % 1 === 0;
  const displayValue =
    spec.kind === "percent"
      ? `${Math.round(value * 100)}%`
      : `${stepsWhole ? value.toLocaleString() : formatNumber(value)}${
          spec.unit ? ` ${spec.unit}` : ""
        }`;

  return (
    <label className="block space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-(--color-mist)">{spec.label}</span>
        <span className="text-(--color-faint)">{displayValue}</span>
      </div>
      <input
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step ?? (spec.kind === "percent" ? 0.01 : 1)}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-white/80"
      />
    </label>
  );
}

export function SimToggle({
  spec,
  value,
  onChange,
}: {
  spec: ParamSpec;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-(--color-mist)">{spec.label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`h-5 w-9 rounded-full border transition-colors ${
          value ? "border-(--color-mint)/50 bg-(--color-mint)/30" : "border-(--color-line) bg-(--color-raised)"
        }`}
      >
        <span
          className={`block h-3.5 w-3.5 translate-y-0.5 rounded-full bg-white transition-transform ${
            value ? "translate-x-4.5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

export function SimSelect({
  spec,
  value,
  onChange,
}: {
  spec: ParamSpec;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-(--color-mist)">{spec.label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full border border-(--color-line) bg-(--color-raised) px-2 py-1.5 text-sm outline-none focus:border-(--color-line)"
      >
        {(spec.choices ?? []).map((choice) => (
          <option key={choice.value} value={choice.value} className="bg-[#0d0d0d]">
            {choice.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SimStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="space-y-0.5 border border-(--color-line) bg-(--color-surface) px-3 py-2.5">
      <p className="label">{label}</p>
      <p className="text-xl leading-tight tabular-nums text-(--color-fg)">{value}</p>
      {hint && <p className="text-xs text-(--color-faint)">{hint}</p>}
    </div>
  );
}

/** A horizontal bar chart — per-server load, per-node key share, etc. */
export function SimBars({
  bars,
  formatValue,
}: {
  bars: { label: string; value: number }[];
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(...bars.map((b) => b.value), 1e-9);
  return (
    <div className="space-y-1.5">
      {bars.map((bar) => (
        <div key={bar.label} className="flex items-center gap-2 text-sm">
          <span className="w-20 shrink-0 truncate text-(--color-mist)">{bar.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-(--color-raised)">
            <div
              className="h-full rounded-full bg-(--color-blueberry)/70"
              style={{ width: `${Math.max(2, (bar.value / max) * 100)}%` }}
            />
          </div>
          <span className="w-14 shrink-0 text-right text-(--color-faint)">
            {formatValue ? formatValue(bar.value) : formatNumber(bar.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SimNotice({ text }: { text: string }) {
  return (
    <p className="border border-(--color-mango)/25 bg-(--color-mango)/[0.06] px-3 py-2 text-sm leading-relaxed text-(--color-mango)/90">
      <span>Notice: </span>
      {text}
    </p>
  );
}

export function formatNumber(value: number): string {
  if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}
