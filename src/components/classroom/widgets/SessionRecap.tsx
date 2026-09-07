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
    <div className="space-y-3 border border-(--color-mint)/30 bg-(--color-mint)/[0.06] p-4">
      <div className="text-(--color-fg)">
        <Markdown text={summary} />
      </div>
      {keyPoints.length > 0 && (
        <ul className="ml-5 list-disc space-y-1 text-sm text-(--color-fg)">
          {keyPoints.map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ul>
      )}
      {nextUp && (
        <p className="text-sm text-(--color-mist)">
          <span className="text-(--color-fg)">Next up:</span> {nextUp}
        </p>
      )}
    </div>
  );
}
