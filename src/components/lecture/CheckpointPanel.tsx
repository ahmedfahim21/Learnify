"use client";

import { Check, RotateCcw, SkipForward, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { LANGUAGES, type Lang } from "@/lib/languages";

import type { CheckState } from "./useCheckpoints";

/**
 * The check that pauses the video. Sits beside the player, never over it.
 *
 * Wrong answers are told in the warn tone, never alert red: a miss is the
 * normal path into a replay, not a failure. The right option and the
 * explanation only appear once the server releases them.
 */

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface Props {
  state: Exclude<CheckState, { mode: "idle" }>;
  lang: Lang;
  index: number;
  total: number;
  onAnswer: (choice: number) => void;
  onResume: () => void;
  onSkipReplay: () => void;
}

export function CheckpointPanel({ state, lang, index, total, onAnswer, onResume, onSkipReplay }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const textLang = LANGUAGES[lang].sarvam;

  // A new question (or the second try) starts clean and takes focus.
  const key = `${state.check.id}:${state.mode}:${"attempt" in state ? state.attempt : 0}`;
  useEffect(() => {
    if (state.mode === "asking") setChoice(null);
    heading.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset per question, not per render
  }, [key]);

  const asking = state.mode === "asking";
  useEffect(() => {
    if (!asking) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select")) return;
      const n = Number(e.key);
      if (n >= 1 && n <= state.check.options.length) {
        e.preventDefault();
        setChoice(n - 1);
      } else if (e.key === "Enter" && choice !== null && !target?.closest("button")) {
        e.preventDefault();
        onAnswer(choice);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [asking, choice, onAnswer, state.check.options.length]);

  return (
    <section aria-labelledby="check-heading" className="space-y-4 rounded-(--radius) border border-(--color-line) bg-(--color-surface) p-5">
      <div className="flex items-center justify-between">
        <p className="label">
          Quick check · {index} of {total}
          {asking && state.attempt === 2 ? " · second try" : ""}
        </p>
        {state.mode !== "replaying" && (
          <button
            type="button"
            onClick={onResume}
            className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm text-(--color-mist) hover:text-(--color-fg)"
          >
            {state.mode === "answered" ? "Continue" : "Skip"}
            <SkipForward size={14} aria-hidden />
          </button>
        )}
      </div>

      <h2 id="check-heading" ref={heading} tabIndex={-1} lang={textLang} className="text-xl leading-snug outline-none" aria-live="assertive">
        {state.check.question}
      </h2>

      {state.mode === "replaying" ? (
        <div className="space-y-3" aria-live="polite">
          <p className="flex items-center gap-2 text-(--color-warn)">
            <RotateCcw size={16} aria-hidden />
            Not quite. Let&apos;s hear that part again
            <span className="font-mono text-sm">
              {formatTime(state.from)}–{formatTime(state.to)}
            </span>
          </p>
          <button
            type="button"
            onClick={onSkipReplay}
            className="inline-flex min-h-11 items-center gap-2 rounded-(--radius) border border-(--color-line) px-3 text-sm hover:border-(--color-faint)"
          >
            Skip replay, try again now
          </button>
        </div>
      ) : (
        <div role="radiogroup" aria-labelledby="check-heading" className="space-y-2">
          {state.check.options.map((option, n) => {
            const answered = state.mode === "answered";
            const picked = answered ? state.choice === n : choice === n;
            const isRight = answered && (state.grade.correct ? state.choice === n : state.grade.answerIndex === n);
            const isWrongPick = answered && picked && !state.grade.correct;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={picked}
                disabled={answered || (asking && state.submitting)}
                onClick={() => setChoice(n)}
                lang={textLang}
                className={[
                  "flex min-h-11 w-full items-start gap-3 rounded-(--radius) border px-3 py-2.5 text-left transition-colors",
                  isRight
                    ? "border-(--color-deep) bg-(--color-deep)/[0.06]"
                    : isWrongPick
                      ? "border-(--color-warn) bg-(--color-warn)/[0.06]"
                      : picked
                        ? "border-(--color-signal) bg-(--color-signal)/[0.05]"
                        : "border-(--color-line) hover:border-(--color-faint)",
                  answered && !isRight && !isWrongPick ? "text-(--color-mist)" : "",
                ].join(" ")}
              >
                <span className="mt-0.5 w-4 shrink-0 font-mono text-xs text-(--color-faint)">{n + 1}</span>
                <span className="flex-1">{option}</span>
                {isRight && <Check size={16} className="mt-1 shrink-0 text-(--color-deep)" aria-label="Right answer" />}
                {isWrongPick && <X size={16} className="mt-1 shrink-0 text-(--color-warn)" aria-label="Your answer" />}
              </button>
            );
          })}
        </div>
      )}

      {asking && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-(--color-faint)">Press 1–{state.check.options.length}, then Enter</p>
          <button
            type="button"
            disabled={choice === null || state.submitting}
            onClick={() => choice !== null && onAnswer(choice)}
            className="min-h-11 rounded-(--radius) bg-(--color-signal) px-4 text-white disabled:opacity-40"
          >
            {state.submitting ? "Checking…" : "Answer"}
          </button>
          {state.error && (
            <p role="alert" className="w-full text-sm text-(--color-alert)">
              Couldn&apos;t check that answer: {state.error}. Try again, or skip.
            </p>
          )}
        </div>
      )}

      {state.mode === "answered" && (
        <div className="space-y-3 border-t border-(--color-line) pt-3" aria-live="polite">
          <p className={state.grade.correct ? "text-(--color-deep)" : "text-(--color-warn)"}>
            {state.grade.correct ? "That's right." : "The right answer is marked."}
          </p>
          {state.grade.explanation && (
            <p lang={textLang} className="text-(--color-mist)">
              {state.grade.explanation}
            </p>
          )}
          <button type="button" onClick={onResume} className="min-h-11 rounded-(--radius) bg-(--color-signal) px-4 text-white">
            Continue the lecture
          </button>
        </div>
      )}
    </section>
  );
}
