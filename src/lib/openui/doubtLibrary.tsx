"use client";

import { createLibrary, defineComponent } from "@openuidev/react-lang";
import { useContext } from "react";

import { LectureClockContext } from "./contexts";
import { AnswerSpec, CalloutSpec, FormulaSpec, ParagraphSpec, StepsSpec, TimeChipSpec } from "./doubtSpec";

export { type LectureClock, LectureClockContext } from "./contexts";

/**
 * The browser's doubt library: React components for the specs in
 * ./doubtSpec, which is also what the server prompts and validates against,
 * so the two can't drift apart. Rendered with `<Renderer library={doubtLibrary} />`.
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

export const Paragraph = defineComponent({
  name: ParagraphSpec.name,
  description: ParagraphSpec.description,
  props: ParagraphSpec.props,
  component: ({ props }) => (
    <>
      <p className="leading-relaxed">{props.text}</p>
      {props.continuation ? <p className="leading-relaxed">{props.continuation}</p> : null}
    </>
  ),
});

export const Steps = defineComponent({
  name: StepsSpec.name,
  description: StepsSpec.description,
  props: StepsSpec.props,
  component: ({ props }) => (
    <ol className="list-decimal space-y-1 pl-5">
      {props.items.map((item, n) => (
        <li key={n}>{item}</li>
      ))}
    </ol>
  ),
});

export const Formula = defineComponent({
  name: FormulaSpec.name,
  description: FormulaSpec.description,
  props: FormulaSpec.props,
  component: ({ props }) => (
    <figure className="rounded-[var(--radius)] bg-[var(--color-surface)] px-3 py-2">
      <code className="font-mono">{props.expression}</code>
      {props.caption ? <figcaption className="text-[var(--color-mist)]">{props.caption}</figcaption> : null}
    </figure>
  ),
});

export const TimeChip = defineComponent({
  name: TimeChipSpec.name,
  description: TimeChipSpec.description,
  props: TimeChipSpec.props,
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
  name: CalloutSpec.name,
  description: CalloutSpec.description,
  props: CalloutSpec.props,
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

export const Answer = defineComponent({
  name: AnswerSpec.name,
  description: AnswerSpec.description,
  props: AnswerSpec.props,
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
