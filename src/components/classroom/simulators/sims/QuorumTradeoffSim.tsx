"use client";

import { useMemo, useState } from "react";

import { evaluateQuorum, QUORUM_PRESETS } from "@/lib/sims/math/quorum";
import type { SimulatorSpec } from "@/lib/sims/types";

import { SimSlider, SimStat } from "../controls";

export function QuorumTradeoffSim({
  spec,
  initial,
}: {
  spec: SimulatorSpec;
  initial: Record<string, number | boolean>;
}) {
  const [n, setN] = useState(Number(initial.n));
  const [w, setW] = useState(Number(initial.w));
  const [r, setR] = useState(Number(initial.r));
  const [replicaLatencyMs, setLatency] = useState(Number(initial.replicaLatencyMs));

  const out = useMemo(
    () => evaluateQuorum({ n, w, r, replicaLatencyMs }),
    [n, w, r, replicaLatencyMs],
  );
  const specOf = (key: string) => spec.params.find((p) => p.key === key)!;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SimSlider spec={specOf("n")} value={n} onChange={setN} />
        <SimSlider spec={specOf("w")} value={w} onChange={setW} />
        <SimSlider spec={specOf("r")} value={r} onChange={setR} />
        <SimSlider spec={specOf("replicaLatencyMs")} value={replicaLatencyMs} onChange={setLatency} />
      </div>

      <div className="flex flex-wrap gap-2">
        {QUORUM_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              setW(Math.min(preset.w, n));
              setR(Math.min(preset.r, n));
            }}
            className="chip"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* The write set and the read set drawn over the same replicas, so the
          overlap that W + R > N guarantees is visible rather than asserted. */}
      <div className="space-y-3 border border-(--color-line) bg-(--color-surface) p-4">
        {[
          { label: "Write reaches", count: w, color: "--color-signal" },
          { label: "Read consults", count: r, color: "--color-deep" },
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            <span className="label w-28 shrink-0">{row.label}</span>
            <span className="flex gap-1.5">
              {Array.from({ length: n }, (_, i) => (
                <span
                  key={i}
                  className="h-6 w-6 border"
                  style={{
                    borderColor: i < row.count ? `var(${row.color})` : "var(--color-line)",
                    background: i < row.count ? `var(${row.color})` : "transparent",
                  }}
                />
              ))}
            </span>
          </div>
        ))}
        <p className={`text-sm ${out.stronglyConsistent ? "text-(--color-deep)" : "text-(--color-warn)"}`}>
          {!out.valid
            ? "W and R cannot exceed N — that quorum is impossible."
            : out.stronglyConsistent
              ? `W + R = ${w + r} > N = ${n}: the two sets must overlap, so a read always sees the latest write.`
              : `W + R = ${w + r} ≤ N = ${n}: the sets can miss each other, so a read may return a stale value.`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SimStat
          label="Consistency"
          value={out.stronglyConsistent ? "Strong" : "Eventual"}
          hint={out.stronglyConsistent ? "W + R > N" : "reads may lag writes"}
        />
        <SimStat
          label="Failures survived"
          value={`${out.failureTolerance}`}
          hint="and still read and write"
        />
        <SimStat label="Write latency" value={`${out.writeLatencyMs} ms`} hint={`waits for ${w}`} />
        <SimStat label="Read latency" value={`${out.readLatencyMs} ms`} hint={`waits for ${r}`} />
      </div>
    </div>
  );
}
