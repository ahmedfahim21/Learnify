"use client";

import { defineComponent } from "@openuidev/react-lang";
import { Play } from "lucide-react";
import { useContext } from "react";

import { LectureClockContext } from "./contexts";
import { Tex, TexExpression } from "./math";
import { CalloutSpec, CompareSpec, FormulaSpec, ParagraphSpec, StepsSpec, TimeChipSpec } from "./doubtSpec";

/**
 * The plain parts every generated card is built from (paragraphs, steps,
 * formulas, moments in the lecture, asides, comparisons), shared by the doubt
 * library and the study-screen library. Model output only ever selects
 * components and fills props: nothing renders raw HTML, and seeking goes
 * through `LectureClock` (clamped to the lecture), not a model-authored action.
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
      <p className="leading-relaxed"><Tex text={props.text} /></p>
      {props.continuation ? <p className="leading-relaxed"><Tex text={props.continuation} /></p> : null}
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
        <li key={n}><Tex text={item} /></li>
      ))}
    </ol>
  ),
});

export const Formula = defineComponent({
  name: FormulaSpec.name,
  description: FormulaSpec.description,
  props: FormulaSpec.props,
  component: ({ props }) => (
    <figure className="overflow-x-auto rounded-xl bg-(--color-surface) px-4 py-3">
      <span className="text-lg"><TexExpression text={props.expression} /></span>
      {props.caption ? <figcaption className="text-sm text-(--color-mist)"><Tex text={props.caption} /></figcaption> : null}
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
        className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-2xl border border-(--color-line) bg-(--color-node) py-1.5 pr-3.5 pl-2.5 text-left text-sm text-(--color-signal) transition-colors hover:border-(--color-signal) disabled:opacity-50"
      >
        <Play size={13} className="shrink-0" aria-hidden />
        {/* The time never wraps; a long label wraps beside it. */}
        <span className="shrink-0 font-mono whitespace-nowrap">{formatTime(sec)}</span>
        <span className="min-w-0"><Tex text={props.label} /></span>
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
      className={`space-y-1 rounded-xl border-l-4 px-4 py-3 ${props.kind === "outside" ? "border-(--color-warn) bg-(--color-warn)/[0.05]" : "border-(--color-signal) bg-(--color-signal)/[0.05]"}`}
    >
      <p className="label">{props.kind === "outside" ? "Beyond this lecture" : "Note"}</p>
      <p><Tex text={props.text} /></p>
    </aside>
  ),
});

export const Compare = defineComponent({
  name: CompareSpec.name,
  description: CompareSpec.description,
  props: CompareSpec.props,
  component: ({ props }) => {
    const width = Math.max(props.headers.length, ...props.rows.map((r) => r.length));
    // Headers may name only the things compared, leaving out the row-label column: give that column an empty header.
    const headers = props.headers.length === width - 1 ? ["", ...props.headers] : props.headers;
    const pad = (cells: string[]) => [...cells, ...Array(Math.max(0, width - cells.length)).fill("")];
    return (
      <div className="overflow-x-auto rounded-xl border border-(--color-line)">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-(--color-surface)">
              {pad(headers).map((h, i) => (
                <th key={i} scope="col" className={`px-3 py-2 text-left font-normal text-(--color-mist) ${i === 0 ? "whitespace-nowrap" : ""}`}>
                  <Tex text={h} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row, r) => (
              <tr key={r} className="border-t border-(--color-line)">
                {pad(row).map((cell, c) =>
                  c === 0 ? (
                    <th key={c} scope="row" className="px-3 py-2 text-left align-top font-normal whitespace-nowrap text-(--color-signal)">
                      <Tex text={cell} />
                    </th>
                  ) : (
                    <td key={c} className="px-3 py-2 align-top">
                      <Tex text={cell} />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  },
});
