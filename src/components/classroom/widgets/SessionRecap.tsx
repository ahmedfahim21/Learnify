"use client";
import type { ComponentDef } from "@/lib/a2ui/messages";

import { Markdown } from "../Markdown";
import { asString } from "../rendererContext";
export function SessionRecap({ def }: { def: ComponentDef }) {
  const summary = asString(def.properties.summary);
  const keyPoints = Array.isArray(def.properties.keyPoints)
    ? (def.properties.keyPoints as unknown[]).map(asString)
    : [];
  const nextUp = asString(def.properties.nextUp);

  return (
    <div className="space-y-3 rounded-xl border border-emerald-400/30 bg-emerald-400/[0.06] p-4">
      <div className="text-white/85">
        <Markdown text={summary} />
      </div>
      {keyPoints.length > 0 && (
        <ul className="ml-5 list-disc space-y-1 text-sm text-white/80">
          {keyPoints.map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ul>
      )}
      {nextUp && (
        <p className="text-sm text-white/60">
          <span className="font-medium text-white/80">Next up:</span> {nextUp}
        </p>
      )}
    </div>
  );
}
