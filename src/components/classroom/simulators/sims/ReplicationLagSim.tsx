"use client";

import { useMemo, useState } from "react";

import { simulateReplication } from "@/lib/sims/math/replication";
import type { SimulatorSpec } from "@/lib/sims/types";

import { SimSlider, SimStat, formatNumber } from "../controls";

export function ReplicationLagSim({
  spec,
  initial,
}: {
  spec: SimulatorSpec;
  initial: Record<string, number | boolean>;
}) {
  const [writeRate, setWriteRate] = useState(Number(initial.writeRate));
  const [applyRate, setApplyRate] = useState(Number(initial.applyRate));
  const [networkMs, setNetworkMs] = useState(Number(initial.networkMs));
  const [sustainedSec, setSustainedSec] = useState(Number(initial.sustainedSec));
  const [replicaCount, setReplicaCount] = useState(Number(initial.replicaCount));

  const out = useMemo(
    () => simulateReplication({ writeRate, applyRate, networkMs, sustainedSec, replicaCount }),
    [writeRate, applyRate, networkMs, sustainedSec, replicaCount],
  );

  const specOf = (key: string) => spec.params.find((p) => p.key === key)!;
  // The replica's position on the write stream, as a fraction of the primary's.
  const caughtUp = out.saturated && writeRate > 0 ? applyRate / writeRate : 1;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SimSlider spec={specOf("writeRate")} value={writeRate} onChange={setWriteRate} />
        <SimSlider spec={specOf("applyRate")} value={applyRate} onChange={setApplyRate} />
        <SimSlider spec={specOf("networkMs")} value={networkMs} onChange={setNetworkMs} />
        <SimSlider spec={specOf("sustainedSec")} value={sustainedSec} onChange={setSustainedSec} />
        <SimSlider spec={specOf("replicaCount")} value={replicaCount} onChange={setReplicaCount} />
      </div>

      {/* Two tracks: what the primary has written, and how far the replica has
          got through it. The gap between them is the lag. */}
      <div className="space-y-2 border border-(--color-line) bg-(--color-surface) p-3">
        <div className="flex items-baseline justify-between">
          <span className="label">Primary</span>
          <span className="label">{formatNumber(writeRate)}/s written</span>
        </div>
        <div className="h-2 w-full bg-(--color-signal)" />
        <div className="flex items-baseline justify-between pt-1">
          <span className="label">Replica</span>
          <span className={`label ${out.saturated ? "text-(--color-alert)" : ""}`}>
            {out.saturated ? "falling behind" : "keeping up"}
          </span>
        </div>
        <div className="h-2 w-full bg-(--color-line)">
          <div
            className={`h-full transition-[width] duration-300 ${
              out.saturated ? "bg-(--color-alert)" : "bg-(--color-deep)"
            }`}
            style={{ width: `${Math.min(1, caughtUp) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SimStat
          label="Replica lag"
          value={out.lagMs >= 1000 ? `${(out.lagMs / 1000).toFixed(1)} s` : `${formatNumber(out.lagMs)} ms`}
          hint={out.saturated ? "growing while overloaded" : "just the network hop"}
        />
        <SimStat label="Backlog" value={formatNumber(out.backlog)} hint="writes not yet applied" />
        <SimStat
          label="Stale read risk"
          value={`${(out.staleReadChance * 100).toFixed(1)}%`}
          hint="reader may miss its own write"
        />
        <SimStat
          label="Read capacity"
          value={`${out.readCapacityMultiple}x`}
          hint="replicas serve reads, not writes"
        />
      </div>
    </div>
  );
}
