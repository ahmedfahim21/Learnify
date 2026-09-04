"use client";

import { useMemo, useState } from "react";

import { estimateCapacity, formatBytes, formatRate } from "@/lib/sims/math/estimation";
import type { SimulatorSpec } from "@/lib/sims/types";

import { SimSlider, SimStat } from "../controls";

/** Compact display for a user count: 1200000 -> "1.2M". */
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

export function BackOfEnvelopeSim({
  spec,
  initial,
}: {
  spec: SimulatorSpec;
  initial: Record<string, number | boolean>;
}) {
  const [dau, setDau] = useState(Number(initial.dau));
  const [writesPerUserPerDay, setWrites] = useState(Number(initial.writesPerUserPerDay));
  const [readWriteRatio, setRatio] = useState(Number(initial.readWriteRatio));
  const [bytesPerWrite, setBytes] = useState(Number(initial.bytesPerWrite));
  const [retentionYears, setRetention] = useState(Number(initial.retentionYears));
  const [peakMultiplier, setPeak] = useState(Number(initial.peakMultiplier));

  const out = useMemo(
    () =>
      estimateCapacity({
        dau,
        writesPerUserPerDay,
        readWriteRatio,
        bytesPerWrite,
        retentionYears,
        peakMultiplier,
      }),
    [dau, writesPerUserPerDay, readWriteRatio, bytesPerWrite, retentionYears, peakMultiplier],
  );

  const specOf = (key: string) => spec.params.find((p) => p.key === key)!;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SimSlider spec={{ ...specOf("dau"), label: `Daily active users (${formatCount(dau)})` }} value={dau} onChange={setDau} />
        <SimSlider spec={specOf("writesPerUserPerDay")} value={writesPerUserPerDay} onChange={setWrites} />
        <SimSlider spec={specOf("readWriteRatio")} value={readWriteRatio} onChange={setRatio} />
        <SimSlider spec={{ ...specOf("bytesPerWrite"), label: `Bytes per write (${formatBytes(bytesPerWrite)})` }} value={bytesPerWrite} onChange={setBytes} />
        <SimSlider spec={specOf("retentionYears")} value={retentionYears} onChange={setRetention} />
        <SimSlider spec={specOf("peakMultiplier")} value={peakMultiplier} onChange={setPeak} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <SimStat label="Writes" value={formatRate(out.writesPerSec)} hint="sustained average" />
        <SimStat label="Reads" value={formatRate(out.readsPerSec)} hint={`${readWriteRatio}:1 read:write`} />
        <SimStat
          label="Peak reads"
          value={formatRate(out.peakReadsPerSec)}
          hint={`${peakMultiplier}x average — size for this`}
        />
        <SimStat label="Storage / day" value={formatBytes(out.bytesPerDay)} />
        <SimStat
          label={`Storage / ${retentionYears}yr`}
          value={formatBytes(out.totalBytes)}
          hint="the number that decides sharding"
        />
        <SimStat
          label="Write bandwidth"
          value={`${formatBytes(out.writeBandwidthBytesPerSec)}/s`}
          hint="what ingest must absorb"
        />
      </div>
    </div>
  );
}
