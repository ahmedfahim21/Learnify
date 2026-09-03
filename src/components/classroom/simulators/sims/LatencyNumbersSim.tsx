"use client";

import { useState } from "react";

import { fitCount, LATENCY_REFERENCES } from "@/lib/sims/math/latencyScale";
import type { SimulatorSpec } from "@/lib/sims/types";

import { SimSlider } from "../controls";

/** Human-readable duration from a nanosecond count. */
function formatNs(ns: number): string {
  if (ns < 1_000) return `${ns} ns`;
  if (ns < 1_000_000) return `${(ns / 1_000).toFixed(ns < 10_000 ? 1 : 0)} µs`;
  if (ns < 1_000_000_000) return `${(ns / 1_000_000).toFixed(ns < 10_000_000 ? 1 : 0)} ms`;
  return `${(ns / 1_000_000_000).toFixed(2)} s`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `${n}`;
}

const MIN_NS = 1;
const MAX_NS = 200_000_000;
/** Log-scale position 0..1 — linear bars would render everything but the
 *  cross-region round trip as an invisible sliver. */
const logPosition = (ns: number) =>
  (Math.log10(ns) - Math.log10(MIN_NS)) / (Math.log10(MAX_NS) - Math.log10(MIN_NS));

export function LatencyNumbersSim({
  spec,
  initial,
}: {
  spec: SimulatorSpec;
  initial: Record<string, number | boolean>;
}) {
  const [budgetMs, setBudgetMs] = useState(Number(initial.budgetMs));
  const budgetNs = budgetMs * 1_000_000;
  const specOf = (key: string) => spec.params.find((p) => p.key === key)!;

  return (
    <div className="space-y-4">
      <SimSlider spec={specOf("budgetMs")} value={budgetMs} onChange={setBudgetMs} />

      <div className="space-y-1.5">
        {LATENCY_REFERENCES.map((ref) => {
          const fits = fitCount(budgetMs, ref.nanoseconds);
          const overBudget = ref.nanoseconds > budgetNs;
          return (
            <div key={ref.id} className="flex items-center gap-2 text-xs">
              <span className="w-[42%] shrink-0 truncate text-white/60">{ref.label}</span>
              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${overBudget ? "bg-rose-400/70" : "bg-emerald-400/60"}`}
                  style={{ width: `${Math.max(1.5, logPosition(ref.nanoseconds) * 100)}%` }}
                />
              </div>
              <span className="w-14 shrink-0 text-right tabular-nums text-white/45">
                {formatNs(ref.nanoseconds)}
              </span>
              <span
                className={`w-16 shrink-0 text-right tabular-nums ${
                  overBudget ? "text-rose-300/80" : "text-white/70"
                }`}
                title={`How many fit in a ${budgetMs}ms budget`}
              >
                {overBudget ? "over budget" : `${formatCount(fits)}×`}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-white/40">
        Bars are log-scaled. The right-hand column is how many of each operation fit inside your{" "}
        {budgetMs}ms budget — red means one alone already blows it.
      </p>
    </div>
  );
}
