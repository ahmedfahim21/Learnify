"use client";

import { useMemo, useState } from "react";

import { REGIONS, simulateCdn } from "@/lib/sims/math/cdnGeo";
import { formatBytes } from "@/lib/sims/math/estimation";
import type { SimulatorSpec } from "@/lib/sims/types";

import { SimSlider, SimStat, formatNumber } from "../controls";

export function CdnGeoSim({
  spec,
  initial,
}: {
  spec: SimulatorSpec;
  initial: Record<string, number | boolean>;
}) {
  const [edgeHitRatio, setHit] = useState(Number(initial.edgeHitRatio));
  const [edgeKm, setEdgeKm] = useState(Number(initial.edgeKm));
  const [originKm, setOriginKm] = useState(Number(initial.originKm));
  const [serverMs, setServerMs] = useState(Number(initial.serverMs));
  const [requestsPerSec, setRps] = useState(Number(initial.requestsPerSec));
  const bytesPerResponse = Number(initial.bytesPerResponse);

  const out = useMemo(
    () => simulateCdn({ edgeHitRatio, edgeKm, originKm, serverMs, requestsPerSec, bytesPerResponse }),
    [edgeHitRatio, edgeKm, originKm, serverMs, requestsPerSec, bytesPerResponse],
  );
  const specOf = (key: string) => spec.params.find((p) => p.key === key)!;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SimSlider spec={specOf("edgeHitRatio")} value={edgeHitRatio} onChange={setHit} />
        <SimSlider spec={specOf("edgeKm")} value={edgeKm} onChange={setEdgeKm} />
        <SimSlider spec={specOf("originKm")} value={originKm} onChange={setOriginKm} />
        <SimSlider spec={specOf("serverMs")} value={serverMs} onChange={setServerMs} />
        <SimSlider spec={specOf("requestsPerSec")} value={requestsPerSec} onChange={setRps} />
      </div>

      {/* Jump the origin slider to a real-world distance, so the numbers stay
          anchored to geography rather than to an abstract slider position. */}
      <div className="flex flex-wrap gap-2">
        {REGIONS.map((region) => (
          <button key={region.id} type="button" onClick={() => setOriginKm(region.km)} className="chip">
            {region.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 border border-(--color-line) bg-(--color-surface) p-4">
        {[
          { label: "To the edge", km: edgeKm, ms: out.edgeRoundTripMs, color: "--color-deep" },
          { label: "To origin", km: originKm, ms: out.originRoundTripMs, color: "--color-warn" },
        ].map((row) => (
          <div key={row.label} className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-(--color-mist)">{row.label}</span>
              <span className="tabular-nums text-(--color-fg)">
                {formatNumber(row.km)} km · {formatNumber(row.ms)} ms
              </span>
            </div>
            <div className="h-2 w-full bg-(--color-line)">
              <div
                className="h-full transition-[width] duration-300"
                style={{
                  width: `${(row.km / Math.max(edgeKm, originKm)) * 100}%`,
                  background: `var(${row.color})`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SimStat
          label="Effective latency"
          value={`${formatNumber(out.effectiveMs)} ms`}
          hint={`vs ${formatNumber(out.originOnlyMs)} ms with no edge`}
        />
        <SimStat
          label="Origin requests"
          value={`${formatNumber(out.originRequestsPerSec)}/s`}
          hint={`of ${formatNumber(requestsPerSec)}/s`}
        />
        <SimStat label="Origin egress" value={`${formatBytes(out.originBytesPerSec)}/s`} />
        <SimStat
          label="Egress avoided"
          value={`${(out.egressSaved * 100).toFixed(0)}%`}
          hint="the bill a CDN actually cuts"
        />
      </div>
    </div>
  );
}
