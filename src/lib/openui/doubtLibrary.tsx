"use client";

import { createLibrary, defineComponent } from "@openuidev/react-lang";
import { useContext } from "react";
import { z } from "zod";

import { LectureClockContext } from "./contexts";

export { type LectureClock, LectureClockContext } from "./contexts";

/**
 * The OpenUI component group a doubt answer may use. sarvam-105b writes OpenUI
 * Lang against `doubtLibrary.prompt()`; the server parses and validates the
 * result against `doubtLibrary.toJSONSchema()` before storing it, and the
 * client renders it with `<Renderer library={doubtLibrary} />`.
 *
 * Model output only ever selects components and fills props — no component
 * renders raw HTML, and seeking goes through `LectureClock` (clamped to the
 * lecture), not through a model-authored action.
 */

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

// The model reliably writes a follow-on sentence as a second string (6 of 6
// invalid answers in the spike did), so the catalog takes it rather than
// fighting it in the prompt.
export const Paragraph = defineComponent({
  name: "Paragraph",
  description: "A paragraph of explanation in the student's language, optionally followed by a second one.",
  props: z.object({ text: z.string(), continuation: z.string().optional() }),
  component: ({ props }) => (
    <>
      <p className="leading-relaxed">{props.text}</p>
      {props.continuation ? <p className="leading-relaxed">{props.continuation}</p> : null}
    </>
  ),
});

export const Steps = defineComponent({
  name: "Steps",
  description: "Numbered steps, e.g. working through a derivation or algorithm one move at a time.",
  props: z.object({ items: z.array(z.string()) }),
  component: ({ props }) => (
    <ol className="list-decimal space-y-1 pl-5">
      {props.items.map((item, n) => (
        <li key={n}>{item}</li>
      ))}
    </ol>
  ),
});

export const Formula = defineComponent({
  name: "Formula",
  description: "A formula or expression, written in plain text math such as 'T(n) = 2T(n/2) + n'.",
  props: z.object({ expression: z.string(), caption: z.string().optional() }),
  component: ({ props }) => (
    <figure className="rounded-[var(--radius)] bg-[var(--color-surface)] px-3 py-2">
      <code className="font-mono">{props.expression}</code>
      {props.caption ? <figcaption className="text-[var(--color-mist)]">{props.caption}</figcaption> : null}
    </figure>
  ),
});

export const TimeChip = defineComponent({
  name: "TimeChip",
  description:
    "A link to a moment in this lecture. `sec` is seconds from the start; `label` says what happens there.",
  props: z.object({ sec: z.number(), label: z.string() }),
  component: function TimeChipView({ props }) {
    const clock = useContext(LectureClockContext);
    const sec = Math.min(Math.max(0, props.sec), clock?.durationSec ?? props.sec);
    return (
      <button
        type="button"
        disabled={!clock}
        onClick={() => clock?.seekTo(sec)}
        aria-label={`Jump to ${formatTime(sec)}: ${props.label}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius)] border border-[var(--color-line)] px-2 text-[var(--color-signal)] disabled:opacity-50"
      >
        <span className="font-mono">{formatTime(sec)}</span>
        <span>{props.label}</span>
      </button>
    );
  },
});

export const Callout = defineComponent({
  name: "Callout",
  description:
    "A short aside. kind 'note' for a tip, 'outside' when the content goes beyond what this lecture said.",
  props: z.object({ kind: z.enum(["note", "outside"]), text: z.string() }),
  // "Beyond this lecture" is labelled in words, not just colour: a student
  // should always know which parts the lecturer actually said.
  component: ({ props }) => (
    <aside
      className={`space-y-1 border-l-2 pl-3 ${props.kind === "outside" ? "border-(--color-warn)" : "border-(--color-signal)"}`}
    >
      <p className="label">{props.kind === "outside" ? "Beyond this lecture" : "Note"}</p>
      <p>{props.text}</p>
    </aside>
  ),
});

const AnswerChild = z.union([Paragraph.ref, Steps.ref, Formula.ref, TimeChip.ref, Callout.ref]);

export const Answer = defineComponent({
  name: "Answer",
  description: "The whole answer card: a short title, then its parts in reading order.",
  props: z.object({ title: z.string(), parts: z.array(AnswerChild) }),
  component: ({ props, renderNode }) => (
    <article className="space-y-3">
      <h3 className="text-lg">{props.title}</h3>
      {renderNode(props.parts)}
    </article>
  ),
});

export const doubtLibrary = createLibrary({
  root: "Answer",
  components: [Answer, Paragraph, Steps, Formula, TimeChip, Callout],
});
