"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { simulateTokenBucket } from "@/lib/sims/math/tokenBucket";
import type { SimulatorSpec } from "@/lib/sims/types";

import { SimSlider, SimStat, formatNumber } from "../controls";

const CHART_W = 320;
const CHART_H = 80;

/** rAF-driven playhead over the precomputed sample series — the one simulator
 *  with a live "run" animation; the underlying math is still fully precomputed
 *  and deterministic, this just sweeps a cursor across it. */
function usePlayhead(sampleCount: number, active: boolean) {
  const [index, setIndex] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || sampleCount === 0) return;
    startRef.current = null;
    const durationMs = Math.min(6000, sampleCount * 25);
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const progress = Math.min(1, elapsed / durationMs);
      setIndex(Math.floor(progress * (sampleCount - 1)));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, sampleCount]);

  useEffect(() => {
    if (!active) setIndex(0);
  }, [active]);

  return index;
}

export function TokenBucketSim({
  spec,
  initial,
}: {
  spec: SimulatorSpec;
  initial: Record<string, number | boolean>;
}) {
  const [capacity, setCapacity] = useState(Number(initial.capacity));
  const [refillPerSec, setRefillPerSec] = useState(Number(initial.refillPerSec));
  const [arrivalPerSec, setArrivalPerSec] = useState(Number(initial.arrivalPerSec));
  const [running, setRunning] = useState(false);

  const output = useMemo(
    () =>
      simulateTokenBucket({
        capacity,
        refillPerSec,
        arrivalPerSec,
        durationSec: Number(initial.durationSec),
      }),
    [capacity, refillPerSec, arrivalPerSec, initial],
  );

  const playhead = usePlayhead(output.samples.length, running);
  useEffect(() => {
    if (running && playhead >= output.samples.length - 1) setRunning(false);
  }, [running, playhead, output.samples.length]);

  const path = useMemo(() => {
    const max = capacity || 1;
    return output.samples
      .map((s, i) => {
        const x = (i / (output.samples.length - 1 || 1)) * CHART_W;
        const y = CHART_H - (s.tokens / max) * CHART_H;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [output.samples, capacity]);

  const cursorX = (playhead / (output.samples.length - 1 || 1)) * CHART_W;
  const specOf = (key: string) => spec.params.find((p) => p.key === key)!;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SimSlider spec={specOf("capacity")} value={capacity} onChange={setCapacity} />
        <SimSlider spec={specOf("refillPerSec")} value={refillPerSec} onChange={setRefillPerSec} />
        <SimSlider spec={specOf("arrivalPerSec")} value={arrivalPerSec} onChange={setArrivalPerSec} />
      </div>

      <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50">Token level over time</span>
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="rounded-lg border border-white/20 px-2.5 py-1 text-xs hover:border-white/40 hover:bg-white/[0.06]"
          >
            {running ? "⏸ Pause" : "▶ Run"}
          </button>
        </div>
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full text-sky-300">
          <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} />
          <line x1={cursorX} x2={cursorX} y1={0} y2={CHART_H} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SimStat label="Accepted" value={formatNumber(output.accepted)} />
        <SimStat label="Rejected" value={formatNumber(output.rejected)} />
        <SimStat label="Accept rate" value={`${(output.acceptRate * 100).toFixed(1)}%`} />
      </div>
    </div>
  );
}
