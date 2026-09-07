"use client";

import { useMemo, useState } from "react";

import { simulateQueueing } from "@/lib/sims/math/queueing";
import type { SimulatorSpec } from "@/lib/sims/types";

import { SimSlider, SimStat, formatNumber } from "../controls";

const CHART_W = 360;
const CHART_H = 120;
/** The curve is drawn to just under 1.0 — at rho = 1 the wait is unbounded. */
const MAX_RHO = 0.97;

export function QueueBackpressureSim({
  spec,
  initial,
}: {
  spec: SimulatorSpec;
  initial: Record<string, number | boolean>;
}) {
  const [arrivalRate, setArrivalRate] = useState(Number(initial.arrivalRate));
  const [serviceRate, setServiceRate] = useState(Number(initial.serviceRate));
  const [workers, setWorkers] = useState(Number(initial.workers));

  const out = useMemo(
    () => simulateQueueing({ arrivalRate, serviceRate, workers }),
    [arrivalRate, serviceRate, workers],
  );

  // Wait time as a function of utilisation, holding service rate and worker
  // count fixed — the hockey stick everyone underestimates until they see it.
  const curve = useMemo(() => {
    const points: { rho: number; wait: number }[] = [];
    for (let i = 1; i <= 80; i++) {
      const rho = (i / 80) * MAX_RHO;
      const lambda = rho * serviceRate * workers;
      points.push({ rho, wait: simulateQueueing({ arrivalRate: lambda, serviceRate, workers }).meanWaitSec });
    }
    return points;
  }, [serviceRate, workers]);

  const maxWait = Math.max(...curve.map((p) => p.wait));
  const round = (n: number) => Math.round(n * 100) / 100;
  const toXY = (rho: number, wait: number) => ({
    x: round((rho / MAX_RHO) * CHART_W),
    y: round(CHART_H - Math.min(1, wait / (maxWait || 1)) * CHART_H),
  });

  const path = curve
    .map((p, i) => {
      const { x, y } = toXY(p.rho, p.wait);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const here = toXY(Math.min(out.utilization, MAX_RHO), out.meanWaitSec);
  const specOf = (key: string) => spec.params.find((p) => p.key === key)!;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SimSlider spec={specOf("arrivalRate")} value={arrivalRate} onChange={setArrivalRate} />
        <SimSlider spec={specOf("serviceRate")} value={serviceRate} onChange={setServiceRate} />
        <SimSlider spec={specOf("workers")} value={workers} onChange={setWorkers} />
      </div>

      <div className="space-y-2 border border-(--color-line) bg-(--color-surface) p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-(--color-mist)">Wait time vs. utilisation</span>
          {out.unstable && (
            <span className="text-xs text-(--color-alert)">
              unstable — arrivals exceed total capacity
            </span>
          )}
        </div>
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full text-(--color-flow)" role="img" aria-label="Queue wait time curve">
          {/* Gridline at rho = 0.8, the point past which the curve runs away. */}
          <line
            x1={(0.8 / MAX_RHO) * CHART_W}
            x2={(0.8 / MAX_RHO) * CHART_W}
            y1={0}
            y2={CHART_H}
            stroke="var(--color-line)"
            strokeDasharray="3 3"
          />
          <path d={path} fill="none" stroke="currentColor" strokeWidth={1.75} />
          <circle cx={here.x} cy={here.y} r={4} fill="var(--color-warn)" />
        </svg>
        <div className="flex justify-between text-[10px] text-(--color-faint)">
          <span>ρ = 0</span>
          <span>ρ = 0.8</span>
          <span>ρ → 1</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SimStat label="Utilisation ρ" value={`${(out.utilization * 100).toFixed(1)}%`} />
        <SimStat label="Mean wait W" value={`${formatNumber(out.meanWaitSec * 1000)} ms`} />
        <SimStat label="In system L" value={formatNumber(out.meanNumberInSystem)} hint="Little's law: L = λW" />
        <SimStat label="Total capacity" value={`${formatNumber(serviceRate * workers)} req/s`} />
      </div>
    </div>
  );
}
