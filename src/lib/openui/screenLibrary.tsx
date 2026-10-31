"use client";

import { createLibrary, defineComponent } from "@openuidev/react-lang";
import { ArrowDown, ArrowUp, Check, Eye, Lightbulb, RotateCcw, X } from "lucide-react";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useId, useMemo, useState } from "react";

import { LectureClockContext } from "./contexts";
import { Callout, Formula, Paragraph, Steps, TimeChip } from "./doubtLibrary";
import {
  ExampleSpec,
  FillBlankSpec,
  KeyIdeaSpec,
  MatchPairsSpec,
  McqSpec,
  OrderStepsSpec,
  QuizSpec,
  RevealSpec,
  ScreenSpec,
  SectionSpec,
  TrueFalseSpec,
} from "./screenSpec";

/**
 * The browser's study-screen library: React for the specs in ./screenSpec.
 * Everything the model writes becomes something to do — reveal, answer,
 * match, reorder — and every question grades instantly with its explanation
 * and a link back to the moment in the lecture.
 */

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Deterministic shuffle seeded by text, so a question keeps its order across renders and streaming. */
function shuffled<T>(items: T[], seedText: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619);
  const order = items.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const j = h % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  // Never hand back the answer already in place.
  if (order.length > 1 && order.every((v, i) => v === i)) order.push(order.shift()!);
  return order;
}

const normalise = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.!?।]$/, "");

function WatchMoment({ sec }: { sec: number }) {
  const clock = useContext(LectureClockContext);
  if (!clock || !Number.isFinite(sec)) return null;
  const at = Math.min(Math.max(0, sec), clock.durationSec);
  return (
    <button
      type="button"
      onClick={() => clock.seekTo(at)}
      className="inline-flex min-h-11 items-center gap-1.5 text-sm text-(--color-signal)"
    >
      <span className="font-mono">{formatTime(at)}</span> Watch where this is explained
    </button>
  );
}

// --- Notes -------------------------------------------------------------------

export const KeyIdea = defineComponent({
  name: KeyIdeaSpec.name,
  description: KeyIdeaSpec.description,
  props: KeyIdeaSpec.props,
  component: ({ props }) => (
    <p className="flex gap-3 rounded-(--radius) bg-(--color-signal)/[0.06] px-4 py-3 text-lg leading-relaxed">
      <Lightbulb size={18} className="mt-1.5 shrink-0 text-(--color-signal)" aria-hidden />
      <span>{props.text}</span>
    </p>
  ),
});

export const Example = defineComponent({
  name: ExampleSpec.name,
  description: ExampleSpec.description,
  props: ExampleSpec.props,
  component: function ExampleView({ props }) {
    const [open, setOpen] = useState(false);
    return (
      <div className="space-y-2 rounded-(--radius) border border-(--color-line) bg-(--color-ink) p-4">
        <p className="label">Worked example</p>
        <p>{props.title}</p>
        <p className="text-(--color-mist)">{props.problem}</p>
        {open ? (
          <p className="border-l-2 border-(--color-deep) pl-3">{props.solution}</p>
        ) : (
          <button type="button" onClick={() => setOpen(true)} className="min-h-11 text-sm text-(--color-signal)">
            Try it, then show the solution
          </button>
        )}
      </div>
    );
  },
});

export const Reveal = defineComponent({
  name: RevealSpec.name,
  description: RevealSpec.description,
  props: RevealSpec.props,
  component: function RevealView({ props }) {
    const [open, setOpen] = useState(false);
    return (
      <div className="space-y-2 rounded-(--radius) border border-dashed border-(--color-warn) p-4">
        <p className="label text-(--color-warn)">Think first</p>
        <p>{props.prompt}</p>
        {open ? (
          <p className="text-(--color-deep)" aria-live="polite">
            {props.answer}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 text-sm text-(--color-signal)"
          >
            <Eye size={15} aria-hidden /> Reveal the answer
          </button>
        )}
      </div>
    );
  },
});

export const Section = defineComponent({
  name: SectionSpec.name,
  description: SectionSpec.description,
  props: SectionSpec.props,
  component: ({ props, renderNode }) => (
    <section className="space-y-3 border-t border-(--color-line) pt-5 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xl">{props.heading}</h3>
        <SectionTime sec={props.sec} />
      </div>
      {renderNode(props.parts)}
    </section>
  ),
});

function SectionTime({ sec }: { sec: number }) {
  const clock = useContext(LectureClockContext);
  if (!clock || !Number.isFinite(sec)) return null;
  return (
    <button type="button" onClick={() => clock.seekTo(Math.min(Math.max(0, sec), clock.durationSec))} className="shrink-0 font-mono text-sm text-(--color-signal)">
      {formatTime(sec)}
    </button>
  );
}

// --- Quiz --------------------------------------------------------------------

/** Each question reports its result here, so the quiz can keep score. */
const ScoreContext = createContext<((id: string, correct: boolean) => void) | null>(null);

function useReport() {
  const report = useContext(ScoreContext);
  const id = useId();
  return useCallback((correct: boolean) => report?.(id, correct), [report, id]);
}

function Result({ correct, explanation, sec, answer }: { correct: boolean; explanation: string; sec: number; answer?: ReactNode }) {
  return (
    <div className="space-y-1.5 border-t border-(--color-line) pt-3" aria-live="polite">
      <p className={`inline-flex items-center gap-1.5 ${correct ? "text-(--color-deep)" : "text-(--color-warn)"}`}>
        {correct ? <Check size={16} aria-hidden /> : <X size={16} aria-hidden />}
        {correct ? "Right." : "Not quite."}
        {!correct && answer ? <span className="text-(--color-fg)">{answer}</span> : null}
      </p>
      <p className="text-(--color-mist)">{explanation}</p>
      <WatchMoment sec={sec} />
    </div>
  );
}

function QuestionCard({ kind, children }: { kind: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-(--radius) border border-(--color-line) bg-(--color-ink) p-4">
      <p className="label">{kind}</p>
      {children}
    </div>
  );
}

function Choices({
  options,
  picked,
  correctIndex,
  onPick,
}: {
  options: string[];
  picked: number | null;
  correctIndex: number;
  onPick: (i: number) => void;
}) {
  const done = picked !== null;
  return (
    <div role="radiogroup" className="space-y-2">
      {options.map((o, i) => {
        const right = done && i === correctIndex;
        const wrong = done && i === picked && i !== correctIndex;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={picked === i}
            disabled={done}
            onClick={() => onPick(i)}
            className={`flex min-h-11 w-full items-center gap-3 rounded-(--radius) border px-3 py-2 text-left transition-colors ${
              right
                ? "border-(--color-deep) bg-(--color-deep)/[0.06]"
                : wrong
                  ? "border-(--color-warn) bg-(--color-warn)/[0.06]"
                  : "border-(--color-line) hover:border-(--color-signal)"
            } ${done && !right && !wrong ? "text-(--color-mist)" : ""}`}
          >
            <span className="flex-1">{o}</span>
            {right && <Check size={16} className="shrink-0 text-(--color-deep)" aria-label="Right answer" />}
            {wrong && <X size={16} className="shrink-0 text-(--color-warn)" aria-label="Your answer" />}
          </button>
        );
      })}
    </div>
  );
}

export const Mcq = defineComponent({
  name: McqSpec.name,
  description: McqSpec.description,
  props: McqSpec.props,
  component: function McqView({ props }) {
    const report = useReport();
    const order = useMemo(() => shuffled(props.options, props.question), [props.options, props.question]);
    const [picked, setPicked] = useState<number | null>(null);
    const valid = Number.isInteger(props.answerIndex) && props.answerIndex >= 0 && props.answerIndex < props.options.length;
    if (!valid) {
      console.error("Mcq with an impossible answer key was not shown:", props.question);
      return null;
    }
    const correctShown = order.indexOf(props.answerIndex);
    return (
      <QuestionCard kind="Choose one">
        <p className="text-lg">{props.question}</p>
        <Choices
          options={order.map((i) => props.options[i])}
          picked={picked}
          correctIndex={correctShown}
          onPick={(i) => {
            setPicked(i);
            report(i === correctShown);
          }}
        />
        {picked !== null && <Result correct={picked === correctShown} explanation={props.explanation} sec={props.sec} />}
      </QuestionCard>
    );
  },
});

export const TrueFalse = defineComponent({
  name: TrueFalseSpec.name,
  description: TrueFalseSpec.description,
  props: TrueFalseSpec.props,
  component: function TrueFalseView({ props }) {
    const report = useReport();
    const [picked, setPicked] = useState<number | null>(null);
    const correct = props.answer ? 0 : 1;
    return (
      <QuestionCard kind="True or false">
        <p className="text-lg">{props.statement}</p>
        <Choices
          options={["True", "False"]}
          picked={picked}
          correctIndex={correct}
          onPick={(i) => {
            setPicked(i);
            report(i === correct);
          }}
        />
        {picked !== null && <Result correct={picked === correct} explanation={props.explanation} sec={props.sec} />}
      </QuestionCard>
    );
  },
});

export const FillBlank = defineComponent({
  name: FillBlankSpec.name,
  description: FillBlankSpec.description,
  props: FillBlankSpec.props,
  component: function FillBlankView({ props }) {
    const report = useReport();
    const [value, setValue] = useState("");
    const [checked, setChecked] = useState<boolean | null>(null);
    const [before, after] = props.prompt.split("___");
    const accepted = [props.answer, ...props.alternatives].map(normalise);
    const check = () => {
      const ok = accepted.includes(normalise(value));
      setChecked(ok);
      report(ok);
    };
    return (
      <QuestionCard kind="Fill in the blank">
        <p className="text-lg leading-loose">
          {before}
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && value.trim() && checked === null && check()}
            disabled={checked !== null}
            aria-label="Your answer"
            className="mx-1 inline-block w-40 border-b-2 border-(--color-signal) bg-transparent px-1 text-center outline-none disabled:border-(--color-line)"
          />
          {after}
        </p>
        {checked === null ? (
          <button
            type="button"
            disabled={!value.trim()}
            onClick={check}
            className="min-h-11 rounded-(--radius) bg-(--color-signal) px-4 text-sm text-white disabled:opacity-40"
          >
            Check
          </button>
        ) : (
          <Result correct={checked} explanation={props.explanation} sec={props.sec} answer={<>The answer is “{props.answer}”.</>} />
        )}
      </QuestionCard>
    );
  },
});

export const MatchPairs = defineComponent({
  name: MatchPairsSpec.name,
  description: MatchPairsSpec.description,
  props: MatchPairsSpec.props,
  component: function MatchPairsView({ props }) {
    const report = useReport();
    const order = useMemo(() => shuffled(props.right, props.instruction), [props.right, props.instruction]);
    const [choice, setChoice] = useState<Record<number, number>>({});
    const [checked, setChecked] = useState(false);
    if (props.left.length < 2 || props.left.length !== props.right.length) {
      console.error("MatchPairs with mismatched lists was not shown:", props.instruction);
      return null;
    }
    const allChosen = props.left.every((_, i) => choice[i] !== undefined);
    const rightCount = props.left.filter((_, i) => choice[i] === i).length;
    return (
      <QuestionCard kind="Match">
        <p className="text-lg">{props.instruction}</p>
        <ul className="space-y-2">
          {props.left.map((l, i) => {
            const ok = checked && choice[i] === i;
            return (
              <li key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                <span>{l}</span>
                <select
                  value={choice[i] ?? ""}
                  disabled={checked}
                  onChange={(e) => setChoice((c) => ({ ...c, [i]: Number(e.target.value) }))}
                  aria-label={`Match for ${l}`}
                  className={`min-h-11 rounded-(--radius) border bg-(--color-surface) px-2 ${
                    checked ? (ok ? "border-(--color-deep)" : "border-(--color-warn)") : "border-(--color-line)"
                  }`}
                >
                  <option value="" disabled>
                    Choose…
                  </option>
                  {order.map((r) => (
                    <option key={r} value={r}>
                      {props.right[r]}
                    </option>
                  ))}
                </select>
                <span className="w-4">
                  {checked && (ok ? <Check size={16} className="text-(--color-deep)" aria-label="Right" /> : <X size={16} className="text-(--color-warn)" aria-label="Wrong" />)}
                </span>
              </li>
            );
          })}
        </ul>
        {checked ? (
          <Result
            correct={rightCount === props.left.length}
            explanation={props.explanation}
            sec={props.sec}
            answer={<>{props.left.map((l, i) => `${l} → ${props.right[i]}`).join(" · ")}</>}
          />
        ) : (
          <button
            type="button"
            disabled={!allChosen}
            onClick={() => {
              setChecked(true);
              report(rightCount === props.left.length);
            }}
            className="min-h-11 rounded-(--radius) bg-(--color-signal) px-4 text-sm text-white disabled:opacity-40"
          >
            Check
          </button>
        )}
      </QuestionCard>
    );
  },
});

export const OrderSteps = defineComponent({
  name: OrderStepsSpec.name,
  description: OrderStepsSpec.description,
  props: OrderStepsSpec.props,
  component: function OrderStepsView({ props }) {
    const report = useReport();
    const initial = useMemo(() => shuffled(props.steps, props.instruction), [props.steps, props.instruction]);
    const [order, setOrder] = useState(initial);
    const [checked, setChecked] = useState(false);
    useEffect(() => setOrder(initial), [initial]);
    const move = (from: number, to: number) =>
      setOrder((o) => {
        const next = [...o];
        [next[from], next[to]] = [next[to], next[from]];
        return next;
      });
    const correct = order.every((v, i) => v === i);
    return (
      <QuestionCard kind="Put in order">
        <p className="text-lg">{props.instruction}</p>
        <ol className="space-y-1.5">
          {order.map((step, pos) => (
            <li
              key={step}
              className={`flex items-center gap-2 rounded-(--radius) border px-3 py-1.5 ${
                checked ? (step === pos ? "border-(--color-deep)" : "border-(--color-warn)") : "border-(--color-line)"
              }`}
            >
              <span className="w-5 font-mono text-sm text-(--color-faint)">{pos + 1}</span>
              <span className="flex-1">{props.steps[step]}</span>
              {!checked && (
                <>
                  <button type="button" disabled={pos === 0} onClick={() => move(pos, pos - 1)} aria-label={`Move “${props.steps[step]}” up`} className="flex h-11 w-9 items-center justify-center text-(--color-mist) disabled:opacity-30">
                    <ArrowUp size={16} aria-hidden />
                  </button>
                  <button type="button" disabled={pos === order.length - 1} onClick={() => move(pos, pos + 1)} aria-label={`Move “${props.steps[step]}” down`} className="flex h-11 w-9 items-center justify-center text-(--color-mist) disabled:opacity-30">
                    <ArrowDown size={16} aria-hidden />
                  </button>
                </>
              )}
            </li>
          ))}
        </ol>
        {checked ? (
          <Result correct={correct} explanation={props.explanation} sec={props.sec} answer={<>{props.steps.join(" → ")}</>} />
        ) : (
          <button
            type="button"
            onClick={() => {
              setChecked(true);
              report(correct);
            }}
            className="min-h-11 rounded-(--radius) bg-(--color-signal) px-4 text-sm text-white"
          >
            Check order
          </button>
        )}
      </QuestionCard>
    );
  },
});

export const Quiz = defineComponent({
  name: QuizSpec.name,
  description: QuizSpec.description,
  props: QuizSpec.props,
  component: function QuizView({ props, renderNode }) {
    const [results, setResults] = useState<Record<string, boolean>>({});
    const [round, setRound] = useState(0);
    const report = useCallback((id: string, correct: boolean) => setResults((r) => (id in r ? r : { ...r, [id]: correct })), []);
    const answered = Object.keys(results).length;
    const right = Object.values(results).filter(Boolean).length;
    const total = props.questions.length;
    return (
      <ScoreContext.Provider value={report}>
        <div className="space-y-4">
          <div className="sticky top-14 z-[1] flex items-center justify-between gap-3 bg-(--color-surface) py-2">
            <h3 className="text-xl">{props.title}</h3>
            <p className="font-mono text-sm text-(--color-mist)" aria-live="polite">
              {right}/{answered} right · {total - answered} left
            </p>
          </div>
          <div key={round} className="space-y-3">
            {renderNode(props.questions)}
          </div>
          {answered === total && total > 0 && (
            <div className="kolam flex flex-wrap items-center justify-between gap-3 rounded-(--radius) border border-(--color-line) p-4">
              <p className="text-lg">
                {right === total ? "All right. " : ""}
                {right} of {total} on the first try.
              </p>
              <button
                type="button"
                onClick={() => {
                  setResults({});
                  setRound((r) => r + 1);
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-(--radius) border border-(--color-line) px-3 text-sm hover:border-(--color-signal)"
              >
                <RotateCcw size={14} aria-hidden /> Try again
              </button>
            </div>
          )}
        </div>
      </ScoreContext.Provider>
    );
  },
});

// --- Root --------------------------------------------------------------------

export const Screen = defineComponent({
  name: ScreenSpec.name,
  description: ScreenSpec.description,
  props: ScreenSpec.props,
  component: ({ props, renderNode }) => (
    <article className="space-y-5">
      <h2 className="text-2xl">{props.title}</h2>
      {renderNode(props.parts)}
    </article>
  ),
});

export const screenLibrary = createLibrary({
  root: "Screen",
  components: [
    Screen,
    Section,
    KeyIdea,
    Example,
    Reveal,
    Quiz,
    Mcq,
    TrueFalse,
    FillBlank,
    MatchPairs,
    OrderSteps,
    Paragraph,
    Steps,
    Formula,
    TimeChip,
    Callout,
  ],
});
