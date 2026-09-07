"use client";
import type { ComponentDef } from "@/lib/a2ui/messages";
import { asNumber, asString } from "../rendererContext";
export function ProgressMeter({ def }: { def: ComponentDef }) {
  const concepts = Array.isArray(def.properties.concepts)
    ? (def.properties.concepts as Array<{ label: string; mastery: number }>)
    : [];
  const phase = asString(def.properties.phase);

  return (
    <div className="space-y-3 border border-(--color-line) bg-(--color-raised) p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-(--color-faint)">Progress</p>
        {phase && (
          <span className="rounded-full border border-(--color-line) px-2 py-0.5 text-xs text-(--color-mist)">
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
              <div className="flex justify-between text-xs text-(--color-mist)">
                <span>{asString(concept.label)}</span>
                <span className="text-(--color-faint)">{pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-(--color-raised)">
                <div
                  className="h-full rounded-full bg-(--color-signal)/70"
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
