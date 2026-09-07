"use client";
import { useRef, useState } from "react";
import type { ComponentDef } from "@/lib/a2ui/messages";
import { asString, emitAction, readOptions, type NodeContext } from "../rendererContext";
import { InlineMarkdown } from "../Markdown";
export function OrderingExercise({
  def,
  ctx,
}: {
  def: ComponentDef;
  ctx: NodeContext;
}) {
  const items = readOptions(def.properties.items);
  const labelOf = new Map(items.map((item) => [item.id, item.label]));
  const [order, setOrder] = useState<string[]>(() => items.map((i) => i.id));
  const [submitted, setSubmitted] = useState(false);
  const dragId = useRef<string | null>(null);
  const locked = submitted || !ctx.interactive;

  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setOrder((prev) => {
      const next = prev.filter((id) => id !== fromId);
      const at = next.indexOf(toId);
      next.splice(at < 0 ? next.length : at, 0, fromId);
      return next;
    });
  };

  const move = (index: number, delta: number) => {
    setOrder((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  return (
    <div className="space-y-3 border border-(--color-line) bg-(--color-raised) p-4">
      <p>
        <InlineMarkdown text={asString(def.properties.prompt)} />
      </p>
      <ol className="space-y-2">
        {order.map((id, index) => (
          <li
            key={id}
            draggable={!locked}
            onDragStart={() => {
              dragId.current = id;
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragId.current) reorder(dragId.current, id);
              dragId.current = null;
            }}
            className={`flex items-center gap-2  border border-(--color-line) bg-(--color-raised) px-3 py-2 text-sm ${
              locked ? "" : "cursor-grab active:cursor-grabbing"
            }`}
          >
            <span className="w-5 text-(--color-faint)">{index + 1}.</span>
            <span className="flex-1">{labelOf.get(id) ?? id}</span>
            <button
              type="button"
              disabled={locked || index === 0}
              onClick={() => move(index, -1)}
              aria-label="Move up"
              className="border border-(--color-line) px-2 py-0.5 text-xs hover:border-(--color-faint) disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              disabled={locked || index === order.length - 1}
              onClick={() => move(index, 1)}
              aria-label="Move down"
              className="border border-(--color-line) px-2 py-0.5 text-xs hover:border-(--color-faint) disabled:opacity-30"
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={locked}
        onClick={() => {
          setSubmitted(true);
          emitAction(ctx, def, "submit_order", {
            orderedIds: order,
            label: `Submitted order: ${order
              .map((id) => labelOf.get(id) ?? id)
              .join(" → ")}`,
          });
        }}
        className="border border-(--color-line) px-3 py-1.5 text-sm hover:border-(--color-faint) hover:bg-(--color-raised) disabled:cursor-not-allowed disabled:opacity-50"
      >
        Submit order
      </button>
    </div>
  );
}
