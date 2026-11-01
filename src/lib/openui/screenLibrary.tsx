"use client";

import { createLibrary, defineComponent } from "@openuidev/react-lang";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Flame,
  Lightbulb,
  Play,
  RotateCcw,
  Sparkles,
  Star,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { type CSSProperties, createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { LectureClockContext, StudyActionsContext, StudyNavContext } from "./contexts";
import { plainMath, Tex } from "./math";
import { Callout, Formula, Paragraph, Steps, TimeChip } from "./parts";
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
 * The quiz plays as a game (one question at a time, a streak, points, a
 * burst when you get one right) and the notes read chapter by chapter, with
 * flip cards to test yourself before moving on.
 */

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Deterministic hash of text, so shuffles and cheers stay put across renders and streaming. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function shuffled<T>(items: T[], seedText: string): number[] {
  let h = hash(seedText);
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

const CHEERS = ["Nailed it.", "Exactly.", "Sharp.", "Spot on.", "That's it.", "Right on."];
const NUDGES = ["Not quite.", "Close, but no.", "Good try."];

/** The accents a pair, a chapter or a confetti piece can take. */
const PALETTE = ["var(--color-signal)", "var(--color-accent)", "var(--color-deep)", "var(--color-flow)", "var(--color-warn)", "var(--color-alert)"];
const GOLD = "#7be0b6";

function Burst({ seed }: { seed: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 16) * Math.PI * 2 + (seed % 7) / 7;
        const dist = 70 + ((seed >>> i) % 60);
        return {
          "--dx": `${Math.round(Math.cos(angle) * dist)}px`,
          "--dy": `${Math.round(Math.sin(angle) * dist - 30)}px`,
          "--r": `${(i * 67) % 360}deg`,
          "--c": PALETTE[i % PALETTE.length],
        } as CSSProperties;
      }),
    [seed],
  );
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {pieces.map((style, i) => (
        <span key={i} className="burst-piece" style={style} />
      ))}
    </span>
  );
}

function WatchMoment({ sec }: { sec: number }) {
  const clock = useContext(LectureClockContext);
  if (!clock || !Number.isFinite(sec)) return null;
  const at = Math.min(Math.max(0, sec), clock.durationSec);
  return (
    <button
      type="button"
      onClick={() => clock.seekTo(at)}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-(--color-line) bg-(--color-node) px-3 text-sm text-(--color-signal) hover:border-(--color-signal)"
    >
      <Play size={13} aria-hidden /> Watch it explained · <span className="font-mono">{formatTime(at)}</span>
    </button>
  );
}

// --- Notes -------------------------------------------------------------------

export const KeyIdea = defineComponent({
  name: KeyIdeaSpec.name,
  description: KeyIdeaSpec.description,
  props: KeyIdeaSpec.props,
  component: ({ props }) => (
    <div className="relative overflow-hidden rounded-xl bg-(--color-signal) px-5 py-5 text-white sm:px-6">
      <span aria-hidden className="kolam absolute inset-0 opacity-25" />
      <p className="relative mb-2 inline-flex items-center gap-1.5 font-mono text-xs tracking-widest text-white/75 uppercase">
        <Lightbulb size={14} aria-hidden /> Key idea
      </p>
      <p className="relative text-xl leading-relaxed text-white"><Tex text={props.text} /></p>
    </div>
  ),
});

export const Example = defineComponent({
  name: ExampleSpec.name,
  description: ExampleSpec.description,
  props: ExampleSpec.props,
  component: function ExampleView({ props }) {
    const [open, setOpen] = useState(false);
    return (
      <div className="space-y-3 rounded-xl border-2 border-(--color-accent)/30 bg-(--color-node) p-5">
        <p className="inline-flex items-center gap-1.5 font-mono text-xs tracking-widest text-(--color-accent) uppercase">
          <Zap size={14} aria-hidden /> Try this one
        </p>
        <p className="text-lg"><Tex text={props.title} /></p>
        <p className="text-(--color-mist)"><Tex text={props.problem} /></p>
        {open ? (
          <div className="rise rounded-lg bg-(--color-deep)/[0.07] p-4">
            <p className="label mb-1 text-(--color-deep)">Solution</p>
            <p><Tex text={props.solution} /></p>
          </div>
        ) : (
          <button type="button" onClick={() => setOpen(true)} className="tile min-h-11 rounded-full bg-(--color-accent) px-5 text-sm text-white">
            I&apos;ve tried it, show me
          </button>
        )}
      </div>
    );
  },
});

/** Active recall as a card to flip: guess, tap, see. */
export const Reveal = defineComponent({
  name: RevealSpec.name,
  description: RevealSpec.description,
  props: RevealSpec.props,
  component: function RevealView({ props }) {
    const [flipped, setFlipped] = useState(false);
    return (
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-pressed={flipped}
        className="flip block w-full text-left"
        data-flipped={flipped}
      >
        <span className="flip-inner">
          <span className="flex min-h-36 flex-col justify-between gap-4 rounded-xl border-2 border-dashed border-(--color-accent)/50 bg-(--color-accent)/[0.06] p-5">
            <span className="font-mono text-xs tracking-widest text-(--color-accent) uppercase">Think first</span>
            <span className="text-lg"><Tex text={props.prompt} /></span>
            <span className="inline-flex items-center gap-1.5 self-end text-sm text-(--color-accent)">
              <RotateCcw size={14} aria-hidden /> Tap to flip
            </span>
          </span>
          <span className="flip-back flex min-h-36 flex-col justify-between gap-4 rounded-xl bg-(--color-deep) p-5 text-white">
            <span className="font-mono text-xs tracking-widest text-white/75 uppercase">Answer</span>
            <span className="text-lg text-white"><Tex text={props.answer} /></span>
            <span className="inline-flex items-center gap-1.5 self-end text-sm text-white/75">
              <RotateCcw size={14} aria-hidden /> Flip back
            </span>
          </span>
        </span>
      </button>
    );
  },
});

/** Which chapter a Section is, when the notes play chapter by chapter. */
const ChapterContext = createContext<{ index: number; total: number } | null>(null);

export const Section = defineComponent({
  name: SectionSpec.name,
  description: SectionSpec.description,
  props: SectionSpec.props,
  component: function SectionView({ props, renderNode }) {
    const chapter = useContext(ChapterContext);
    return (
      <section className="space-y-4">
        <div className="flex items-start gap-4">
          {chapter && (
            <span aria-hidden className="font-mono text-4xl leading-none" style={{ color: PALETTE[chapter.index % PALETTE.length] }}>
              {String(chapter.index + 1).padStart(2, "0")}
            </span>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-2xl"><Tex text={props.heading} /></h3>
            <SectionTime sec={props.sec} />
          </div>
        </div>
        {renderNode(props.parts)}
      </section>
    );
  },
});

function SectionTime({ sec }: { sec: number }) {
  const clock = useContext(LectureClockContext);
  if (!clock || !Number.isFinite(sec)) return null;
  return (
    <button
      type="button"
      onClick={() => clock.seekTo(Math.min(Math.max(0, sec), clock.durationSec))}
      className="inline-flex items-center gap-1.5 text-sm text-(--color-signal)"
    >
      <Play size={12} aria-hidden /> From <span className="font-mono">{formatTime(sec)}</span> in the lecture
    </button>
  );
}

// --- Quiz --------------------------------------------------------------------

/** A question reports its result to the quiz through this, keyed by its place in the quiz. */
const SlotContext = createContext<{ index: number; report: (index: number, correct: boolean) => void } | null>(null);

function useReport() {
  const slot = useContext(SlotContext);
  return useCallback((correct: boolean) => slot?.report(slot.index, correct), [slot]);
}

function Result({ correct, explanation, sec, answer }: { correct: boolean; explanation: string; sec: number; answer?: ReactNode }) {
  const seed = hash(explanation);
  return (
    <div className={`rise space-y-2 rounded-xl p-4 ${correct ? "bg-(--color-deep)/[0.08]" : "bg-(--color-warn)/[0.08]"}`} aria-live="polite">
      <p className={`flex items-center gap-2 text-lg ${correct ? "text-(--color-deep)" : "text-(--color-warn)"}`}>
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-white ${correct ? "bg-(--color-deep)" : "bg-(--color-warn)"}`}>
          {correct ? <Check size={16} aria-hidden /> : <X size={16} aria-hidden />}
        </span>
        {correct ? CHEERS[seed % CHEERS.length] : NUDGES[seed % NUDGES.length]}
      </p>
      {!correct && answer ? <p>{answer}</p> : null}
      <p className="text-(--color-mist)"><Tex text={explanation} /></p>
      <WatchMoment sec={sec} />
    </div>
  );
}

function QuestionCard({ kind, children }: { kind: string; children: ReactNode }) {
  return (
    <div className="@container space-y-5">
      <p className="inline-flex rounded-full bg-(--color-raised) px-3 py-1 font-mono text-xs tracking-widest text-(--color-mist) uppercase">{kind}</p>
      {children}
    </div>
  );
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function Choices({
  options,
  picked,
  correctIndex,
  onPick,
  columns = 1,
  icons,
}: {
  options: string[];
  picked: number | null;
  correctIndex: number;
  onPick: (i: number) => void;
  columns?: 1 | 2;
  icons?: ReactNode[];
}) {
  const done = picked !== null;
  // Short answers (a symbol, a number, a word) sit two-up even in a narrow card.
  const short = options.every((o) => plainMath(o).length <= 24);
  return (
    <div role="radiogroup" className={`grid gap-3 ${columns === 2 || short ? "grid-cols-2" : "@xl:grid-cols-2"}`}>
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
            className={`tile relative flex min-h-16 w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left ${
              right
                ? "pop border-(--color-deep) bg-(--color-deep)/[0.08]"
                : wrong
                  ? "shake border-(--color-warn) bg-(--color-warn)/[0.08]"
                  : done
                    ? "border-(--color-line) bg-(--color-node) text-(--color-mist)"
                    : "border-(--color-line) bg-(--color-node) hover:border-(--color-signal)"
            }`}
          >
            <span
              aria-hidden
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-sm ${
                right ? "bg-(--color-deep) text-white" : wrong ? "bg-(--color-warn) text-white" : "bg-(--color-raised) text-(--color-mist)"
              }`}
            >
              {right ? <Check size={16} /> : wrong ? <X size={16} /> : (icons?.[i] ?? LETTERS[i])}
            </span>
            <span className="flex-1 text-base"><Tex text={o} /></span>
            {right && <span className="sr-only">Right answer</span>}
            {wrong && <span className="sr-only">Your answer</span>}
            {right && picked === i && <Burst seed={hash(o)} />}
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
      <QuestionCard kind="Pick one">
        <p className="text-2xl leading-snug"><Tex text={props.question} /></p>
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
        <p className="text-2xl leading-snug"><Tex text={props.statement} /></p>
        <Choices
          options={["True", "False"]}
          columns={2}
          icons={[<Check key="t" size={16} />, <X key="f" size={16} />]}
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
      <QuestionCard kind="Fill the gap">
        <p className="text-2xl leading-loose">
          <Tex text={before ?? ""} />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && value.trim() && checked === null && check()}
            disabled={checked !== null}
            aria-label="Your answer"
            placeholder="type here"
            className={`mx-1 inline-block w-44 rounded-lg border-2 border-dashed bg-(--color-node) px-2 py-0.5 text-center text-xl outline-none placeholder:text-base placeholder:text-(--color-faint) focus:border-solid ${
              checked === null
                ? "border-(--color-signal)"
                : checked
                  ? "pop border-solid border-(--color-deep) text-(--color-deep)"
                  : "shake border-solid border-(--color-warn) text-(--color-warn)"
            }`}
          />
          <Tex text={after ?? ""} />
        </p>
        {checked === null ? (
          <button type="button" disabled={!value.trim()} onClick={check} className="tile min-h-12 rounded-full bg-(--color-signal) px-6 text-white disabled:opacity-40">
            Check
          </button>
        ) : (
          <div className="relative">
            {checked && <Burst seed={hash(value)} />}
            <Result correct={checked} explanation={props.explanation} sec={props.sec} answer={<>The answer is “<Tex text={props.answer} />”.</>} />
          </div>
        )}
      </QuestionCard>
    );
  },
});

/** Tap a term, then tap what it goes with; each pair takes its own colour. */
export const MatchPairs = defineComponent({
  name: MatchPairsSpec.name,
  description: MatchPairsSpec.description,
  props: MatchPairsSpec.props,
  component: function MatchPairsView({ props }) {
    const report = useReport();
    const order = useMemo(() => shuffled(props.right, props.instruction), [props.right, props.instruction]);
    /** left index → right index */
    const [pairs, setPairs] = useState<Record<number, number>>({});
    const [active, setActive] = useState<number | null>(null);
    const [checked, setChecked] = useState(false);
    if (props.left.length < 2 || props.left.length !== props.right.length) {
      console.error("MatchPairs with mismatched lists was not shown:", props.instruction);
      return null;
    }
    const ownerOf = (r: number) => {
      const l = Object.keys(pairs).find((k) => pairs[Number(k)] === r);
      return l === undefined ? -1 : Number(l);
    };
    const colour = (l: number) => PALETTE[l % PALETTE.length];
    const allPaired = props.left.every((_, i) => pairs[i] !== undefined);
    const rightCount = props.left.filter((_, i) => pairs[i] === i).length;
    const without = (p: Record<number, number>, l: number) => {
      const next = { ...p };
      delete next[l];
      return next;
    };

    const tapLeft = (l: number) => {
      if (pairs[l] !== undefined) {
        setPairs((p) => without(p, l));
        setActive(l);
      } else setActive(active === l ? null : l);
    };
    const tapRight = (r: number) => {
      const owner = ownerOf(r);
      if (active === null) {
        if (owner >= 0) setPairs((p) => without(p, owner));
        return;
      }
      setPairs((p) => ({ ...(owner >= 0 ? without(p, owner) : p), [active]: r }));
      setActive(null);
    };

    const tile = (key: number, label: string, pairedWith: number, isActive: boolean, ok: boolean | null, onClick: () => void, aria: string) => (
      <li key={key}>
        <button
          type="button"
          onClick={onClick}
          disabled={checked}
          aria-label={aria}
          aria-pressed={isActive}
          className={`tile flex min-h-14 w-full items-center gap-2 rounded-xl border-2 px-3 py-2 text-left ${ok === true ? "pop" : ok === false ? "shake" : ""} ${
            isActive ? "ring-2 ring-(--color-signal) ring-offset-2 ring-offset-(--color-ink)" : ""
          }`}
          style={{
            borderColor: ok === false ? "var(--color-warn)" : pairedWith >= 0 ? colour(pairedWith) : "var(--color-line)",
            background: pairedWith >= 0 ? `color-mix(in srgb, ${colour(pairedWith)} 9%, var(--color-node))` : "var(--color-node)",
          }}
        >
          <span
            aria-hidden
            className="h-3 w-3 shrink-0 rounded-full border-2"
            style={{ borderColor: pairedWith >= 0 ? colour(pairedWith) : "var(--color-line)", background: pairedWith >= 0 ? colour(pairedWith) : "transparent" }}
          />
          <span className="flex-1"><Tex text={label} /></span>
          {ok === true && <Check size={16} className="text-(--color-deep)" aria-hidden />}
          {ok === false && <X size={16} className="text-(--color-warn)" aria-hidden />}
        </button>
      </li>
    );

    return (
      <QuestionCard kind="Match them up">
        <p className="text-2xl leading-snug">{props.instruction}</p>
        <p className="text-sm text-(--color-mist)">Tap one on the left, then its match on the right.</p>
        <div className="grid grid-cols-2 gap-3">
          <ul className="space-y-2">
            {props.left.map((l, i) =>
              tile(i, l, pairs[i] !== undefined ? i : -1, active === i, checked ? pairs[i] === i : null, () => tapLeft(i), `Match for ${plainMath(l)}`),
            )}
          </ul>
          <ul className="space-y-2">
            {order.map((r) => {
              const owner = ownerOf(r);
              return tile(r, props.right[r], owner, false, checked && owner >= 0 ? owner === r : null, () => tapRight(r), plainMath(props.right[r]));
            })}
          </ul>
        </div>
        {checked ? (
          <div className="relative">
            {rightCount === props.left.length && <Burst seed={hash(props.instruction)} />}
            <Result
              correct={rightCount === props.left.length}
              explanation={props.explanation}
              sec={props.sec}
              answer={<Tex text={props.left.map((l, i) => `${l} → ${props.right[i]}`).join(" · ")} />}
            />
          </div>
        ) : (
          <button
            type="button"
            disabled={!allPaired}
            onClick={() => {
              setChecked(true);
              report(rightCount === props.left.length);
            }}
            className="tile min-h-12 rounded-full bg-(--color-signal) px-6 text-white disabled:opacity-40"
          >
            Check my matches
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
    const [moved, setMoved] = useState<number | null>(null);
    useEffect(() => setOrder(initial), [initial]);
    const move = (from: number, to: number) => {
      setMoved(order[from]);
      setOrder((o) => {
        const next = [...o];
        [next[from], next[to]] = [next[to], next[from]];
        return next;
      });
    };
    const correct = order.every((v, i) => v === i);
    return (
      <QuestionCard kind="Put in order">
        <p className="text-2xl leading-snug">{props.instruction}</p>
        <ol className="space-y-2">
          {order.map((step, pos) => {
            const ok = checked ? step === pos : null;
            return (
              <li
                key={step}
                className={`flex items-center gap-3 rounded-xl border-2 bg-(--color-node) px-3 py-2 transition-colors ${
                  ok === true ? "border-(--color-deep)" : ok === false ? "border-(--color-warn)" : "border-(--color-line)"
                } ${moved === step && !checked ? "pop" : ""}`}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm text-white"
                  style={{ background: ok === false ? "var(--color-warn)" : ok === true ? "var(--color-deep)" : PALETTE[pos % PALETTE.length] }}
                >
                  {pos + 1}
                </span>
                <span className="flex-1"><Tex text={props.steps[step]} /></span>
                {!checked && (
                  <span className="flex">
                    <button
                      type="button"
                      disabled={pos === 0}
                      onClick={() => move(pos, pos - 1)}
                      aria-label={`Move “${plainMath(props.steps[step])}” up`}
                      className="flex h-11 w-10 items-center justify-center rounded-lg text-(--color-mist) hover:bg-(--color-raised) disabled:opacity-25"
                    >
                      <ArrowUp size={18} aria-hidden />
                    </button>
                    <button
                      type="button"
                      disabled={pos === order.length - 1}
                      onClick={() => move(pos, pos + 1)}
                      aria-label={`Move “${plainMath(props.steps[step])}” down`}
                      className="flex h-11 w-10 items-center justify-center rounded-lg text-(--color-mist) hover:bg-(--color-raised) disabled:opacity-25"
                    >
                      <ArrowDown size={18} aria-hidden />
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        {checked ? (
          <div className="relative">
            {correct && <Burst seed={hash(props.instruction)} />}
            <Result correct={correct} explanation={props.explanation} sec={props.sec} answer={<Tex text={props.steps.join(" → ")} />} />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setChecked(true);
              report(correct);
            }}
            className="tile min-h-12 rounded-full bg-(--color-signal) px-6 text-white"
          >
            Lock in this order
          </button>
        )}
      </QuestionCard>
    );
  },
});

const POINTS = 10;
const STREAK_BONUS = 5;

export function starsFor(right: number, total: number): 0 | 1 | 2 | 3 {
  const r = total ? right / total : 0;
  return r >= 0.9 ? 3 : r >= 0.6 ? 2 : r >= 0.3 ? 1 : 0;
}

/** Points for a right answer: a streak of three or more earns a bonus. */
export function pointsFor(streak: number): number {
  return POINTS + (streak >= 3 ? STREAK_BONUS : 0);
}

/** The quiz as a game: one question at a time, a path of dots, a streak and points. */
export const Quiz = defineComponent({
  name: QuizSpec.name,
  description: QuizSpec.description,
  props: QuizSpec.props,
  component: function QuizView({ props, renderNode }) {
    const total = props.questions.length;
    const [results, setResults] = useState<Record<number, boolean>>({});
    const [current, setCurrent] = useState(0);
    const [round, setRound] = useState(0);
    const [streak, setStreak] = useState(0);
    const [best, setBest] = useState(0);
    const [points, setPoints] = useState(0);
    const [gain, setGain] = useState<{ n: number; key: number } | null>(null);
    const [finished, setFinished] = useState(false);
    // Saving a finished quiz to the profile: once per round, only when signed in.
    const actions = useContext(StudyActionsContext);
    const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");

    const report = useCallback(
      (index: number, correct: boolean) => {
        if (index in results) return;
        setResults((r) => ({ ...r, [index]: correct }));
        if (correct) {
          const s = streak + 1;
          const n = pointsFor(s);
          setStreak(s);
          setBest((b) => Math.max(b, s));
          setPoints((p) => p + n);
          setGain({ n, key: Date.now() });
        } else {
          setStreak(0);
          setGain(null);
        }
      },
      [results, streak],
    );

    const answered = Object.keys(results).length;
    const right = Object.values(results).filter(Boolean).length;
    const stars = starsFor(right, total);
    const currentDone = current in results;
    const isLast = current === total - 1;
    const firstMiss = Object.keys(results).find((k) => results[Number(k)] === false);

    useEffect(() => {
      if (!finished || !actions || save !== "idle") return;
      setSave("saving");
      actions.quizFinished({ score: right, total, points, bestStreak: best }).then(
        () => setSave("saved"),
        (err: Error) => {
          console.error("saving the quiz result failed:", err);
          setSave("error");
        },
      );
    }, [finished, actions, save, right, total, points, best]);

    const restart = () => {
      setResults({});
      setCurrent(0);
      setStreak(0);
      setBest(0);
      setPoints(0);
      setGain(null);
      setFinished(false);
      setRound((r) => r + 1);
      setSave("idle");
    };
    const next = useCallback(() => {
      if (isLast) setFinished(true);
      else setCurrent((c) => c + 1);
    }, [isLast]);

    // Enter moves on once the question is answered.
    useEffect(() => {
      if (!currentDone || finished) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Enter" && !(e.target as HTMLElement | null)?.closest("input, textarea, button")) next();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [currentDone, finished, next]);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-2xl"><Tex text={props.title} /></h3>
          <div className="flex items-center gap-2 font-mono text-sm" aria-live="polite">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 transition-colors ${
                streak >= 2 ? "bg-(--color-accent) text-white" : "bg-(--color-raised) text-(--color-mist)"
              }`}
              title="Right answers in a row"
            >
              <Flame size={14} aria-hidden key={streak} className={streak >= 2 ? "pop" : ""} /> {streak}
              <span className="sr-only"> in a row</span>
            </span>
            <span className="relative inline-flex items-center gap-1 rounded-full bg-(--color-signal) px-3 py-1.5 text-white" title="Points">
              <Zap size={14} aria-hidden /> {points}
              <span className="sr-only"> points</span>
              {gain && (
                <span key={gain.key} aria-hidden className="float-up absolute -top-5 right-1 text-sm text-(--color-accent)">
                  +{gain.n}
                </span>
              )}
            </span>
          </div>
        </div>

        <ol className="flex items-center gap-1.5" aria-label={`Question ${current + 1} of ${total}`}>
          {props.questions.map((_, i) => {
            const r = results[i];
            const here = i === current && !finished;
            return (
              <li key={i} className="flex-1">
                <button
                  type="button"
                  onClick={() => {
                    setFinished(false);
                    setCurrent(i);
                  }}
                  aria-label={`Question ${i + 1}${r === true ? ", right" : r === false ? ", missed" : ""}`}
                  aria-current={here ? "step" : undefined}
                  className="flex h-6 w-full items-center"
                >
                  <span
                    className={`block w-full rounded-full transition-all ${here ? "h-3" : "h-2"} ${
                      r === true ? "bg-(--color-deep)" : r === false ? "bg-(--color-warn)" : here ? "bg-(--color-signal)" : "bg-(--color-raised)"
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ol>

        <div key={round}>
          {props.questions.map((q, i) => (
            <div key={i} hidden={finished || i !== current} className={i === current ? "rise" : undefined}>
              <SlotContext.Provider value={{ index: i, report }}>{renderNode(q)}</SlotContext.Provider>
            </div>
          ))}
        </div>

        {!finished && total > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-(--color-line) pt-4">
            <button
              type="button"
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0}
              className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm text-(--color-mist) hover:text-(--color-fg) disabled:opacity-30"
            >
              <ArrowLeft size={15} aria-hidden /> Back
            </button>
            <span className="font-mono text-sm text-(--color-faint)">
              {current + 1} / {total}
            </span>
            <button
              type="button"
              onClick={next}
              className={`tile inline-flex min-h-12 items-center gap-2 rounded-full px-6 ${
                currentDone ? "bg-(--color-signal) text-white" : "text-(--color-mist) hover:text-(--color-fg)"
              }`}
            >
              {currentDone ? (isLast ? "See my score" : "Next") : "Skip"} <ArrowRight size={16} aria-hidden />
            </button>
          </div>
        )}

        {finished && (
          <div className="rise relative overflow-hidden rounded-2xl bg-(--color-signal) p-6 text-center text-white sm:p-10">
            <span aria-hidden className="kolam absolute inset-0 opacity-20" />
            {stars === 3 && <Burst seed={points} />}
            <div className="relative space-y-4">
              <Trophy size={40} className="mx-auto" style={{ color: GOLD }} aria-hidden />
              <div className="flex justify-center gap-2" role="img" aria-label={`${stars} of 3 stars`}>
                {[0, 1, 2].map((s) => (
                  <Star
                    key={s}
                    size={34}
                    aria-hidden
                    className={s < stars ? "pop" : "opacity-30"}
                    style={{ animationDelay: `${s * 0.12}s`, color: GOLD, fill: s < stars ? GOLD : "transparent" }}
                  />
                ))}
              </div>
              <p className="text-5xl text-white">
                {right}
                <span className="text-2xl text-white/60"> / {total}</span>
              </p>
              <p className="text-white/80">
                {right === total ? "A perfect round." : stars >= 2 ? "Solid. Go for three stars?" : "Every miss shows you what to rewatch."}
              </p>
              <div className="flex flex-wrap justify-center gap-3 font-mono text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
                  <Zap size={14} aria-hidden /> {points} points
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
                  <Flame size={14} aria-hidden /> best streak {best}
                </span>
                {answered < total && <span className="rounded-full bg-white/15 px-3 py-1.5">{total - answered} skipped</span>}
              </div>
              <p className="text-sm text-white/75" aria-live="polite" role={save === "error" ? "alert" : undefined}>
                {!actions ? (
                  <a href="/signin" className="underline underline-offset-2 hover:text-white">
                    Sign in to keep your scores
                  </a>
                ) : save === "saving" ? (
                  "Saving to your profile…"
                ) : save === "saved" ? (
                  "Saved to your profile"
                ) : save === "error" ? (
                  "Couldn't save this result to your profile"
                ) : null}
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <button type="button" onClick={restart} className="tile inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-(--color-signal)">
                  <RotateCcw size={15} aria-hidden /> Play again
                </button>
                {firstMiss !== undefined && (
                  <button
                    type="button"
                    onClick={() => {
                      setFinished(false);
                      setCurrent(Number(firstMiss));
                    }}
                    className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/40 px-6 text-white hover:bg-white/10"
                  >
                    Review what I missed
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
});

// --- Root --------------------------------------------------------------------

function isSection(v: unknown): v is { typeName: "Section"; props: { heading?: unknown } } {
  return typeof v === "object" && v !== null && (v as { typeName?: unknown }).typeName === "Section";
}

/** Notes play chapter by chapter: a path of chapters on top, one open at a time. */
function Chapters({
  title,
  parts,
  renderNode,
}: {
  title: string;
  parts: { props: { heading?: unknown } }[];
  renderNode: (v: unknown) => ReactNode;
}) {
  const goTo = useContext(StudyNavContext);
  const actions = useContext(StudyActionsContext);
  const [current, setCurrent] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const total = parts.length;

  // Every chapter opened counts as reading the notes, once, toward the streak.
  const [reported, setReported] = useState(false);
  useEffect(() => {
    if (reported || !actions || total < 2 || seen.size < total) return;
    setReported(true);
    actions.notesFinished().catch((err: Error) => console.error("recording finished notes failed:", err));
  }, [reported, actions, total, seen]);
  const open = (i: number) => {
    setCurrent(i);
    setSeen((s) => new Set(s).add(i));
  };
  const isLast = current === total - 1;
  const heading = (i: number) => String(parts[i]?.props.heading ?? `Part ${i + 1}`);

  return (
    <article className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-2xl"><Tex text={title} /></h2>
          <span className="shrink-0 font-mono text-sm text-(--color-faint)">
            {seen.size} of {total} read
          </span>
        </div>
        <ol className="flex gap-2 overflow-x-auto pb-1">
          {parts.map((_, i) => {
            const here = i === current;
            const c = PALETTE[i % PALETTE.length];
            return (
              <li key={i} className="shrink-0">
                <button
                  type="button"
                  onClick={() => open(i)}
                  aria-current={here ? "step" : undefined}
                  className="tile flex max-w-52 items-center gap-2 rounded-full border-2 py-1.5 pr-3 pl-1.5 text-left text-sm"
                  style={{
                    borderColor: here ? c : "var(--color-line)",
                    background: here ? `color-mix(in srgb, ${c} 10%, var(--color-node))` : "var(--color-node)",
                  }}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs text-white"
                    style={{ background: seen.has(i) ? c : "var(--color-faint)" }}
                  >
                    {seen.has(i) && !here ? <Check size={12} aria-label="Read" /> : i + 1}
                  </span>
                  <span className={`truncate ${here ? "text-(--color-fg)" : "text-(--color-mist)"}`}><Tex text={heading(i)} /></span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {parts.map((p, i) => (
        <div key={i} hidden={i !== current} className={i === current ? "rise" : undefined}>
          <ChapterContext.Provider value={{ index: i, total }}>{renderNode(p)}</ChapterContext.Provider>
        </div>
      ))}

      <div className="flex items-center justify-between gap-3 border-t border-(--color-line) pt-4">
        <button
          type="button"
          onClick={() => open(Math.max(0, current - 1))}
          disabled={current === 0}
          className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm text-(--color-mist) hover:text-(--color-fg) disabled:opacity-30"
        >
          <ArrowLeft size={15} aria-hidden /> Back
        </button>
        {isLast ? (
          goTo && (
            <button type="button" onClick={() => goTo("quiz")} className="tile inline-flex min-h-12 items-center gap-2 rounded-full bg-(--color-accent) px-6 text-white">
              <Sparkles size={16} aria-hidden /> Done reading. Quiz me
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={() => open(current + 1)}
            className="tile inline-flex min-h-12 max-w-[70%] items-center gap-2 rounded-full bg-(--color-signal) px-6 text-white"
          >
            <span className="truncate">Next: <Tex text={heading(current + 1)} /></span> <ArrowRight size={16} className="shrink-0" aria-hidden />
          </button>
        )}
      </div>
    </article>
  );
}

export const Screen = defineComponent({
  name: ScreenSpec.name,
  description: ScreenSpec.description,
  props: ScreenSpec.props,
  component: ({ props, renderNode }) => {
    const sections = (props.parts as unknown[]).filter(isSection);
    if (sections.length >= 2) return <Chapters title={props.title} parts={sections} renderNode={renderNode} />;
    return <article className="space-y-6">{renderNode(props.parts)}</article>;
  },
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
