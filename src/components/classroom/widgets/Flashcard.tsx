"use client";
import { useState } from "react";
import type { ComponentDef } from "@/lib/a2ui/messages";

import { Markdown } from "../Markdown";
import { asString, emitAction, type NodeContext } from "../rendererContext";
export function Flashcard({ def, ctx }: { def: ComponentDef; ctx: NodeContext }) {
  const [flipped, setFlipped] = useState(false);
  const [rated, setRated] = useState<number | null>(null);
  const front = asString(def.properties.front);
  const back = asString(def.properties.back);
  const hint = asString(def.properties.hint);
  const locked = rated !== null || !ctx.interactive;

  return (
    <div className="space-y-3 rounded-xl border border-white/15 bg-white/[0.03] p-4">
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="w-full rounded-lg border border-white/15 bg-white/[0.04] p-4 text-left transition hover:border-white/30"
      >
        <span className="text-xs uppercase tracking-widest text-white/40">
          {flipped ? "Back" : "Front"} · tap to flip
        </span>
        <div className="mt-1 text-white/90">
          <Markdown text={flipped ? back : front} />
        </div>
        {!flipped && hint && (
          <p className="mt-2 text-xs text-white/40">Hint: {hint}</p>
        )}
      </button>
      {flipped && (
        <div className="space-y-2">
          <p className="text-xs text-white/50">How well did you recall this?</p>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4, 5].map((quality) => (
              <button
                key={quality}
                type="button"
                disabled={locked}
                onClick={() => {
                  setRated(quality);
                  emitAction(ctx, def, "rate_recall", {
                    quality,
                    label: `Self-rated recall ${quality}/5`,
                  });
                }}
                className={`h-9 w-9 rounded-lg border text-sm transition ${
                  rated === quality
                    ? "border-white/60 bg-white/15"
                    : "border-white/15 hover:border-white/40 hover:bg-white/[0.06]"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {quality}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
