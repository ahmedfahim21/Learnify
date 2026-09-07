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
    <div className="space-y-3 border border-(--color-line) bg-(--color-raised) p-4">
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="w-full border border-(--color-line) bg-(--color-raised) p-4 text-left transition hover:border-(--color-faint)"
      >
        <span className="text-xs uppercase tracking-widest text-(--color-faint)">
          {flipped ? "Back" : "Front"} · tap to flip
        </span>
        <div className="mt-1 text-(--color-fg)">
          <Markdown text={flipped ? back : front} />
        </div>
        {!flipped && hint && (
          <p className="mt-2 text-xs text-(--color-faint)">Hint: {hint}</p>
        )}
      </button>
      {flipped && (
        <div className="space-y-2">
          <p className="text-xs text-(--color-mist)">How well did you recall this?</p>
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
                className={`h-9 w-9  border text-sm transition ${
                  rated === quality
                    ? "border-(--color-line) bg-(--color-raised)"
                    : "border-(--color-line) hover:border-(--color-faint) hover:bg-(--color-raised)"
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
