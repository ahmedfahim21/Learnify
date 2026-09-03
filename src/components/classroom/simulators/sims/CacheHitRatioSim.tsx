"use client";

import { useMemo, useState } from "react";

import { simulateCacheHitRatio } from "@/lib/sims/math/cacheLatency";
import type { SimulatorSpec } from "@/lib/sims/types";

import { SimSlider, SimStat, formatNumber } from "../controls";

export function CacheHitRatioSim({
  spec,
  initial,
}: {
  spec: SimulatorSpec;
  initial: Record<string, number | boolean>;
}) {
  const [hitRatio, setHitRatio] = useState(Number(initial.hitRatio));
  const [cacheLatencyMs, setCacheLatencyMs] = useState(Number(initial.cacheLatencyMs));
  const [originLatencyMs, setOriginLatencyMs] = useState(Number(initial.originLatencyMs));
  const [qps, setQps] = useState(Number(initial.qps));

  const output = useMemo(
    () =>
      simulateCacheHitRatio({
        hitRatio,
        cacheLatencyMs,
        originLatencyMs,
        qps,
        cacheSizeGb: Number(initial.cacheSizeGb),
        cacheCostPerGbMonth: Number(initial.cacheCostPerGbMonth),
        originCostPerMillion: Number(initial.originCostPerMillion),
      }),
    [hitRatio, cacheLatencyMs, originLatencyMs, qps, initial],
  );

  const specOf = (key: string) => spec.params.find((p) => p.key === key)!;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SimSlider spec={specOf("hitRatio")} value={hitRatio} onChange={setHitRatio} />
        <SimSlider spec={specOf("cacheLatencyMs")} value={cacheLatencyMs} onChange={setCacheLatencyMs} />
        <SimSlider spec={specOf("originLatencyMs")} value={originLatencyMs} onChange={setOriginLatencyMs} />
        <SimSlider spec={specOf("qps")} value={qps} onChange={setQps} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SimStat label="Effective latency" value={`${formatNumber(output.effectiveLatencyMs)} ms`} />
        <SimStat label="Origin traffic" value={`${formatNumber(output.originQps)} req/s`} />
        <SimStat label="Cache absorbs" value={`${formatNumber(output.cacheQps)} req/s`} />
        <SimStat label="Monthly cost" value={`$${formatNumber(output.monthlyTotalCost)}`} hint={`cache $${formatNumber(output.monthlyCacheCost)} + origin $${formatNumber(output.monthlyOriginCost)}`} />
      </div>
    </div>
  );
}
