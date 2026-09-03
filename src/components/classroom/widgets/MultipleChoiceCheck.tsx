"use client";
import { useState } from "react";
import type { ComponentDef } from "@/lib/a2ui/messages";
import { asString, emitAction, type NodeContext } from "../rendererContext";
export function MultipleChoiceCheck({
  def,
  ctx,
}: {
  def: ComponentDef;
  ctx: NodeContext;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const prompt = asString(def.properties.prompt);
  const options = Array.isArray(def.properties.options)
    ? (def.properties.options as Array<{ id: string; label: string }>)
    : [];

  return (
    <div className="space-y-3 rounded-xl border border-white/15 bg-white/[0.03] p-4">
      <p className="font-medium">{prompt}</p>
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const isChosen = chosen === option.id;
          const locked = chosen !== null || !ctx.interactive;
          return (
            <button
              key={option.id}
              type="button"
              disabled={locked}
              onClick={() => {
                setChosen(option.id);
                emitAction(ctx, def, "select", {
                  optionId: option.id,
                  label: option.label,
                });
              }}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                isChosen
                  ? "border-white/60 bg-white/15"
                  : "border-white/15 hover:border-white/40 hover:bg-white/[0.06]"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
