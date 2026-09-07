"use client";
import { useState } from "react";
import type { ComponentDef } from "@/lib/a2ui/messages";
import { asString, emitAction, type NodeContext } from "../rendererContext";
import { InlineMarkdown } from "../Markdown";
export function FreeResponse({ def, ctx }: { def: ComponentDef; ctx: NodeContext }) {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const prompt = asString(def.properties.prompt);
  const placeholder = asString(def.properties.placeholder);
  const locked = submitted || !ctx.interactive;

  return (
    <div className="space-y-3 border border-(--color-line) bg-(--color-raised) p-4">
      <p><InlineMarkdown text={prompt} /></p>
      <textarea
        value={text}
        disabled={locked}
        rows={3}
        placeholder={placeholder || "Type your answer…"}
        onChange={(event) => setText(event.target.value)}
        className="w-full resize-y border border-(--color-line) bg-(--color-raised) p-3 text-sm outline-none focus:border-(--color-line) disabled:opacity-60"
      />
      <button
        type="button"
        disabled={locked || !text.trim()}
        onClick={() => {
          setSubmitted(true);
          emitAction(ctx, def, "submit_text", {
            text: text.trim(),
            label: text.trim(),
          });
        }}
        className="border border-(--color-line) px-3 py-1.5 text-sm hover:border-(--color-faint) hover:bg-(--color-raised) disabled:cursor-not-allowed disabled:opacity-50"
      >
        Submit answer
      </button>
    </div>
  );
}
