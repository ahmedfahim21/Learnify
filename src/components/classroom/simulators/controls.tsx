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
  const displayValue =
    spec.kind === "percent" ? `${Math.round(value * 100)}%` : `${formatNumber(value)}${spec.unit ? ` ${spec.unit}` : ""}`;

  return (
    <label className="block space-y-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-white/70">{spec.label}</span>
        <span className="text-white/40">{displayValue}</span>
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
    <label className="flex items-center justify-between gap-3 text-xs">
      <span className="text-white/70">{spec.label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`h-5 w-9 rounded-full border transition-colors ${
          value ? "border-emerald-400/50 bg-emerald-400/30" : "border-white/20 bg-white/10"
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
      <span className="text-xs text-white/70">{spec.label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-white/15 bg-white/[0.04] px-2 py-1.5 text-sm outline-none focus:border-white/40"
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
    <div className="space-y-0.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-white/40">{label}</p>
      <p className="text-lg leading-tight font-medium text-white/90">{value}</p>
      {hint && <p className="text-[11px] text-white/40">{hint}</p>}
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
        <div key={bar.label} className="flex items-center gap-2 text-xs">
          <span className="w-20 shrink-0 truncate text-white/50">{bar.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-sky-400/70"
              style={{ width: `${Math.max(2, (bar.value / max) * 100)}%` }}
            />
          </div>
          <span className="w-14 shrink-0 text-right text-white/40">
            {formatValue ? formatValue(bar.value) : formatNumber(bar.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SimNotice({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-100/90">
      <span className="font-medium">Notice: </span>
      {text}
    </p>
  );
}

export function formatNumber(value: number): string {
  if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}
