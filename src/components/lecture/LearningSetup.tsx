"use client";

import { ArrowLeft, ArrowRight, BookOpen, Check, Feather, Flame, Layers, type LucideIcon, Pause, Play, Target, Trophy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { LANGUAGES, type Lang } from "@/lib/languages";
import type { Goal, Level, Preferences } from "@/lib/preferences";

/**
 * Four quick taps before anything is generated: the language to learn in,
 * what the student is here for, how hard to pitch it, and whether the video
 * should stop for checks. Nothing costs a generation until this is saved.
 */

interface Choice<T> {
  value: T;
  label: string;
  hint: string;
  icon: LucideIcon;
  colour: string;
}

const GOALS: Choice<Goal>[] = [
  { value: "understand", label: "Understand it properly", hint: "Start with notes, chapter by chapter", icon: BookOpen, colour: "var(--color-signal)" },
  { value: "practise", label: "Test myself", hint: "Start with a quiz, play for points", icon: Trophy, colour: "var(--color-accent)" },
  { value: "revise", label: "Revise fast", hint: "Start with flashcards before an exam", icon: Layers, colour: "var(--color-flow)" },
];

const LEVELS: Choice<Level>[] = [
  { value: "simpler", label: "Go easy on me", hint: "Plain words, more examples", icon: Feather, colour: "var(--color-deep)" },
  { value: "standard", label: "Just right", hint: "As the lecture pitches it", icon: Target, colour: "var(--color-signal)" },
  { value: "harder", label: "Challenge me", hint: "Trickier questions, fewer hints", icon: Flame, colour: "var(--color-alert)" },
];

const CHECKS: Choice<boolean>[] = [
  { value: true, label: "Yes, pause me", hint: "A quick question when the lecture reaches it", icon: Pause, colour: "var(--color-warn)" },
  { value: false, label: "No, let me watch", hint: "Study afterwards in the modes below", icon: Play, colour: "var(--color-mist)" },
];

const STEPS = ["Language", "Goal", "Level", "Checks"] as const;

function Tiles<T>({ choices, value, onPick }: { choices: Choice<T>[]; value: T | null; onPick: (v: T) => void }) {
  return (
    <div role="radiogroup" className="grid gap-3">
      {choices.map((c) => {
        const on = value === c.value;
        return (
          <button
            key={String(c.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(c.value)}
            className="tile flex items-center gap-4 rounded-2xl border-2 p-4 text-left"
            style={{
              borderColor: on ? c.colour : "var(--color-line)",
              background: on ? `color-mix(in srgb, ${c.colour} 9%, var(--color-node))` : "var(--color-node)",
            }}
          >
            <span
              aria-hidden
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white transition-transform"
              style={{ background: c.colour, transform: on ? "rotate(-6deg) scale(1.05)" : undefined }}
            >
              <c.icon size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg leading-tight">{c.label}</span>
              <span className="block text-sm text-(--color-mist)">{c.hint}</span>
            </span>
            {on && <Check size={18} aria-hidden style={{ color: c.colour }} />}
          </button>
        );
      })}
    </div>
  );
}

export function LearningSetup({
  initial,
  suggestedLang,
  onSave,
  onCancel,
}: {
  /** The current choices, when changing them; null the first time. */
  initial: Preferences | null;
  suggestedLang: Lang;
  onSave: (prefs: Preferences) => Promise<unknown>;
  /** Present only when there's something to go back to. */
  onCancel?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [lang, setLang] = useState<Lang>(initial?.lang ?? suggestedLang);
  const [goal, setGoal] = useState<Goal | null>(initial?.goal ?? null);
  const [level, setLevel] = useState<Level | null>(initial?.level ?? null);
  const [checks, setChecks] = useState<boolean | null>(initial?.checks ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const picked = [true, goal !== null, level !== null, checks !== null];
  const last = step === STEPS.length - 1;

  // Picking moves on by itself: one tap per step.
  const pickThen = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    if (!last) setTimeout(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 180);
  };

  async function finish() {
    if (goal === null || level === null || checks === null) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ lang, goal, level, checks });
    } catch (err) {
      console.error("saving preferences failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-(--color-fg)/40 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-title"
        tabIndex={-1}
        className="rise relative flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-(--color-ink) shadow-(--shadow-card) outline-none sm:rounded-3xl"
      >
        <div className="kolam relative space-y-3 border-b border-(--color-line) px-5 pt-5 pb-4 sm:px-7">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close without changing anything"
              className="absolute top-3 right-3 flex h-11 w-11 items-center justify-center rounded-full text-(--color-mist) hover:bg-(--color-raised)"
            >
              <X size={18} aria-hidden />
            </button>
          )}
          <p className="label">{initial ? "Change how you learn" : "Before we start"}</p>
          <h2 id="setup-title" className="pr-10 text-3xl">
            {["Which language do you want to learn in?", "What are you here for?", "How hard should we pitch it?", "Stop the video for quick checks?"][step]}
          </h2>
          <ol className="flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <li key={s} className="flex-1">
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  disabled={!picked.slice(0, i).every(Boolean)}
                  aria-label={s}
                  aria-current={i === step ? "step" : undefined}
                  className="flex h-6 w-full items-center disabled:cursor-not-allowed"
                >
                  <span className={`block h-2 w-full rounded-full transition-colors ${i <= step || picked[i] ? "bg-(--color-signal)" : "bg-(--color-raised)"}`} />
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div key={step} className="rise flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {step === 0 && (
            <div role="radiogroup" aria-label="Language" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {(Object.entries(LANGUAGES) as [Lang, (typeof LANGUAGES)[Lang]][]).map(([code, l]) => {
                const on = lang === code;
                return (
                  <button
                    key={code}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => pickThen(setLang)(code)}
                    className={`tile flex min-h-16 flex-col items-start justify-center rounded-2xl border-2 px-3 py-2 text-left ${
                      on ? "border-(--color-signal) bg-(--color-signal)/[0.08]" : "border-(--color-line) bg-(--color-node)"
                    }`}
                  >
                    <span lang={l.sarvam} className="text-xl leading-tight">
                      {l.native}
                    </span>
                    {l.native !== l.name && <span className="text-xs text-(--color-mist)">{l.name}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {step === 1 && <Tiles choices={GOALS} value={goal} onPick={pickThen(setGoal)} />}
          {step === 2 && <Tiles choices={LEVELS} value={level} onPick={pickThen(setLevel)} />}
          {step === 3 && (
            <div className="space-y-4">
              <Tiles choices={CHECKS} value={checks} onPick={pickThen(setChecks)} />
              {checks && (
                <p className="text-sm text-(--color-mist)">
                  Checks, flashcards and the concept map come from one study pack, built the first time anyone asks for them.
                </p>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="mt-4 text-sm text-(--color-alert)">
              Couldn&apos;t save that: {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-(--color-line) px-5 py-4 sm:px-7">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm text-(--color-mist) hover:text-(--color-fg) disabled:invisible"
          >
            <ArrowLeft size={15} aria-hidden /> Back
          </button>
          {last ? (
            <button
              type="button"
              onClick={finish}
              disabled={!picked.every(Boolean) || saving}
              className="tile inline-flex min-h-12 items-center gap-2 rounded-full bg-(--color-accent) px-6 text-white disabled:opacity-40"
            >
              {saving ? "Saving…" : initial ? "Save" : "Start learning"} <ArrowRight size={16} aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!picked[step]}
              className="tile inline-flex min-h-12 items-center gap-2 rounded-full bg-(--color-signal) px-6 text-white disabled:opacity-40"
            >
              Next <ArrowRight size={16} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
