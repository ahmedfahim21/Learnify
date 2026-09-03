"use client";

import { useMemo, useState } from "react";

import { simulateLoadBalancer, type LoadBalancerAlgorithm } from "@/lib/sims/math/loadBalancer";
import type { SimulatorSpec } from "@/lib/sims/types";

import { SimBars, SimSelect, SimSlider, SimStat, formatNumber } from "../controls";

const ALGORITHMS: LoadBalancerAlgorithm[] = ["round-robin", "least-connections", "random", "hash"];

export function LoadBalancerSim({
  spec,
  initial,
}: {
  spec: SimulatorSpec;
  initial: Record<string, number | boolean>;
}) {
  const [serverCount, setServerCount] = useState(Number(initial.serverCount));
  const [requestCount, setRequestCount] = useState(Number(initial.requestCount));
  const [skew, setSkew] = useState(Number(initial.skew));
  const [algorithmIndex, setAlgorithmIndex] = useState(Number(initial.algorithm));

  const output = useMemo(
    () =>
      simulateLoadBalancer({
        serverCount,
        requestCount,
        skew,
        algorithm: ALGORITHMS[algorithmIndex] ?? "round-robin",
      }),
    [serverCount, requestCount, skew, algorithmIndex],
  );

  const specOf = (key: string) => spec.params.find((p) => p.key === key)!;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SimSelect spec={specOf("algorithm")} value={algorithmIndex} onChange={setAlgorithmIndex} />
        <SimSlider spec={specOf("serverCount")} value={serverCount} onChange={setServerCount} />
        <SimSlider spec={specOf("requestCount")} value={requestCount} onChange={setRequestCount} />
        <SimSlider spec={specOf("skew")} value={skew} onChange={setSkew} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SimStat label="Mean load" value={formatNumber(output.meanLoad)} />
        <SimStat label="Max load" value={formatNumber(output.maxLoad)} />
        <SimStat label="Imbalance ratio" value={`${output.imbalanceRatio.toFixed(2)}x`} hint="1.0x is perfectly even" />
      </div>
      <SimBars
        bars={output.perServerLoad.map((load, i) => ({ label: `Server ${i + 1}`, value: load }))}
      />
    </div>
  );
}
