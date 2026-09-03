"use client";
import type { ComponentDef } from "@/lib/a2ui/messages";
import { asNumber, asString } from "../rendererContext";
export function ProgressMeter({ def }: { def: ComponentDef }) {
  const concepts = Array.isArray(def.properties.concepts)
    ? (def.properties.concepts as Array<{ label: string; mastery: number }>)
    : [];
  const phase = asString(def.properties.phase);

  return (
    <div className="space-y-3 rounded-xl border border-white/15 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-white/40">Progress</p>
        {phase && (
          <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-white/60">
            {phase}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {concepts.map((concept, index) => {
          const pct = Math.round(
            Math.min(Math.max(asNumber(concept.mastery), 0), 1) * 100,
          );
          return (
            <div key={index} className="space-y-1">
              <div className="flex justify-between text-xs text-white/70">
                <span>{asString(concept.label)}</span>
                <span className="text-white/40">{pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-400/70"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
