"use client";
import { useState } from "react";
import type { ComponentDef } from "@/lib/a2ui/messages";
import { asString, emitAction, type NodeContext } from "../rendererContext";
import { InlineMarkdown } from "../Markdown";
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
    <div className="space-y-3 border border-(--color-line) bg-(--color-raised) p-4">
      <p>
        <InlineMarkdown text={prompt} />
      </p>
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
              className={`border px-3 py-2 text-left text-sm transition ${
                isChosen
                  ? "border-(--color-line) bg-(--color-raised)"
                  : "border-(--color-line) hover:border-(--color-faint) hover:bg-(--color-raised)"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <InlineMarkdown text={option.label} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
