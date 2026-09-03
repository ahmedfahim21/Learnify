"use client";
import { useState } from "react";
import type { ComponentDef } from "@/lib/a2ui/messages";
import { asString, emitAction, type NodeContext } from "../rendererContext";
export function FreeResponse({ def, ctx }: { def: ComponentDef; ctx: NodeContext }) {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const prompt = asString(def.properties.prompt);
  const placeholder = asString(def.properties.placeholder);
  const locked = submitted || !ctx.interactive;

  return (
    <div className="space-y-3 rounded-xl border border-white/15 bg-white/[0.03] p-4">
      <p className="font-medium">{prompt}</p>
      <textarea
        value={text}
        disabled={locked}
        rows={3}
        placeholder={placeholder || "Type your answer…"}
        onChange={(event) => setText(event.target.value)}
        className="w-full resize-y rounded-lg border border-white/15 bg-white/[0.04] p-3 text-sm outline-none focus:border-white/40 disabled:opacity-60"
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
        className="rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:border-white/40 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Submit answer
      </button>
    </div>
  );
}
