"use client";
import { useState } from "react";
import type { ComponentDef } from "@/lib/a2ui/messages";
import { asString, emitAction, readOptions, type NodeContext } from "../rendererContext";
export function MatchingPairs({ def, ctx }: { def: ComponentDef; ctx: NodeContext }) {
  const left = readOptions(def.properties.left);
  const right = readOptions(def.properties.right);
  const labelOf = new Map(
    [...left, ...right].map((item) => [item.id, item.label]),
  );
  const [activeLeft, setActiveLeft] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const locked = submitted || !ctx.interactive;
  const usedRight = new Set(Object.values(pairs));
  const prompt = asString(def.properties.prompt);

  const partnerLabel = (rightId: string) => {
    const leftId = Object.keys(pairs).find((l) => pairs[l] === rightId);
    return leftId ? labelOf.get(leftId) : undefined;
  };

  return (
    <div className="space-y-3 rounded-xl border border-white/15 bg-white/[0.03] p-4">
      {prompt && <p className="font-medium">{prompt}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          {left.map((item) => {
            const matched = item.id in pairs;
            return (
              <button
                key={item.id}
                type="button"
                disabled={locked}
                onClick={() => setActiveLeft(item.id)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  activeLeft === item.id
                    ? "border-sky-400/70 bg-sky-400/10"
                    : matched
                      ? "border-emerald-400/40 bg-emerald-400/[0.06]"
                      : "border-white/15 hover:border-white/40"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {item.label}
                {matched && (
                  <span className="block text-xs text-emerald-300/80">
                    → {labelOf.get(pairs[item.id])}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2">
          {right.map((item) => {
            const taken = usedRight.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                disabled={locked || activeLeft === null}
                onClick={() => {
                  if (activeLeft === null) return;
                  setPairs((prev) => ({ ...prev, [activeLeft]: item.id }));
                  setActiveLeft(null);
                }}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  taken
                    ? "border-emerald-400/40 bg-emerald-400/[0.06]"
                    : "border-white/15 hover:border-white/40"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {item.label}
                {taken && (
                  <span className="block text-xs text-emerald-300/80">
                    ← {partnerLabel(item.id)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        disabled={locked || Object.keys(pairs).length === 0}
        onClick={() => {
          setSubmitted(true);
          const list = Object.entries(pairs).map(([leftId, rightId]) => ({
            leftId,
            rightId,
          }));
          emitAction(ctx, def, "submit_pairs", {
            pairs: list,
            label: `Matched: ${list
              .map(
                (p) => `${labelOf.get(p.leftId)} → ${labelOf.get(p.rightId)}`,
              )
              .join("; ")}`,
          });
        }}
        className="rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:border-white/40 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Submit matches
      </button>
    </div>
  );
}
