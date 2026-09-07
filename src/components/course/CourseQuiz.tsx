"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { DESIGN_PHASE_LABELS } from "@/content/systemDesign/types";
import type { QuizQuestion } from "@/content/systemDesign/quizTypes";

import { Markdown } from "../classroom/Markdown";

/**
 * The pre-generated quiz runner.
 *
 * Deliberately built to feel like the tutor's generated checks — same card,
 * same option buttons, same explain-after-answering rhythm — while being
 * entirely static: no model call, no session, no account. It's what stays
 * available when someone is signed out or has spent their daily budget.
 */
export function CourseQuiz({
  slug,
  title,
  questions,
}: {
  slug: string;
  title: string;
  questions: QuizQuestion[];
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // Explicit, so answering the last question still shows its explanation
  // before the score replaces the card.
  const [showResult, setShowResult] = useState(false);

  const question = questions[index];
  const chosen = question ? answers[question.id] : undefined;
  const answered = chosen !== undefined;
  const isLast = index === questions.length - 1;

  const score = useMemo(
    () => questions.filter((q) => answers[q.id] === q.correctOptionId).length,
    [questions, answers],
  );

  if (!question) return null;

  if (showResult) {
    const missed = questions.filter((q) => answers[q.id] !== q.correctOptionId);
    return (
      <div className="space-y-8">
        <div className="space-y-3 border border-(--color-line) bg-(--color-surface) p-6">
          <p className="label">Result</p>
          <p className="text-3xl tabular-nums">
            {score} <span className="text-(--color-mist)">/ {questions.length}</span>
          </p>
          <p className="text-(--color-mist)">
            {score === questions.length
              ? "Every one. Worth trying the tutor for the parts this quiz can't push on."
              : `${missed.length} to revisit — each one links back to the chapter it came from.`}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setAnswers({});
                setIndex(0);
                setShowResult(false);
              }}
              className="chip"
            >
              Try again
            </button>
            <Link href={`/courses/${slug}`} className="chip">
              Back to the course
            </Link>
          </div>
        </div>

        {missed.length > 0 && (
          <div className="space-y-4">
            <div className="label-rule">
              <span className="label">What to revisit</span>
            </div>
            {missed.map((q) => (
              <div key={q.id} className="space-y-2 border-l-2 border-(--color-strawberry) bg-(--color-surface) px-4 py-3">
                <Link href={`/courses/${slug}#chapter-${q.phase}`} className="label">
                  {DESIGN_PHASE_LABELS[q.phase]} →
                </Link>
                <p className="text-(--color-fg)">{q.question}</p>
                <div className="prose text-[0.95rem]">
                  <Markdown text={q.explanation} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="label">
            {index + 1} / {questions.length}
          </span>
          <span className="label">{DESIGN_PHASE_LABELS[question.phase]}</span>
        </div>
        <div className="h-0.5 w-full overflow-hidden bg-(--color-line)">
          <div
            className="h-full bg-(--color-mint) transition-[width] duration-300"
            style={{ width: `${((index + (answered ? 1 : 0)) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-4 border border-(--color-line) bg-(--color-surface) p-6">
        <p className="text-lg text-(--color-fg)">{question.question}</p>

        <div className="flex flex-col gap-2">
          {question.options.map((option) => {
            const isChosen = chosen === option.id;
            const isAnswer = option.id === question.correctOptionId;
            const tone = !answered
              ? "border-(--color-line) hover:border-(--color-faint) hover:bg-(--color-raised)"
              : isAnswer
                ? "border-(--color-mint)/60 bg-(--color-mint)/10 text-(--color-fg)"
                : isChosen
                  ? "border-(--color-strawberry)/50 bg-(--color-strawberry)/10 text-(--color-fg)"
                  : "border-(--color-line) opacity-50";
            return (
              <button
                key={option.id}
                type="button"
                disabled={answered}
                onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option.id }))}
                className={`border px-4 py-3 text-left text-sm transition-colors disabled:cursor-default ${tone}`}
              >
                {option.label}
                {answered && isAnswer && <span className="ml-2 text-(--color-mint)">correct</span>}
              </button>
            );
          })}
        </div>

        {answered && (
          <div className="space-y-1 border-l-2 border-(--color-mint) pl-3">
            <p className="label">{chosen === question.correctOptionId ? "Right" : "Not quite"}</p>
            <div className="prose text-[0.95rem]">
              <Markdown text={question.explanation} />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="chip disabled:cursor-not-allowed disabled:opacity-30"
        >
          ← Previous
        </button>
        <span className="label">{title}</span>
        {/* Hidden rather than disabled until answered: an inert "Next" is the
            kind of dead control that makes a quiz feel broken. */}
        {answered && (
          <button
            type="button"
            onClick={() => (isLast ? setShowResult(true) : setIndex((i) => i + 1))}
            className="chip"
          >
            {isLast ? "See result →" : "Next →"}
          </button>
        )}
      </div>
    </div>
  );
}
