"use client";

import { useMemo, useState } from "react";

import type { AuthoredConcept } from "@/content/systemDesign/types";
import { getQuiz } from "@/content/systemDesign/quizzes";

import { Markdown } from "../classroom/Markdown";

/**
 * The gate at the end of a chapter.
 *
 * Progress used to be inferred from scroll position, which measured travel
 * rather than understanding. Here the reader has to do something: answer the
 * chapter's check, or — where the bank has no question for this stage —
 * acknowledge a refresher of what the chapter taught.
 *
 * A wrong answer does not block completion. The explanation is the teaching
 * moment, and gatekeeping on a first guess would push people to look the
 * answer up rather than think. What is required is engagement, not a score.
 */
export function ChapterCompleter({
  problemSlug,
  phase,
  skills,
  completed,
  signedIn,
  onComplete,
}: {
  problemSlug: string;
  phase: string;
  skills: AuthoredConcept[];
  completed: boolean;
  signedIn: boolean;
  onComplete: () => void;
}) {
  const question = useMemo(
    () => getQuiz(problemSlug).find((q) => q.phase === phase),
    [problemSlug, phase],
  );
  const [chosen, setChosen] = useState<string | null>(null);
  const answered = chosen !== null;

  if (completed) {
    return (
      <div className="max-w-(--measure-prose) border border-(--color-deep)/40 bg-(--color-deep)/[0.06] px-4 py-3">
        <p className="label text-(--color-deep)">Chapter complete</p>
      </div>
    );
  }

  return (
    <div className="max-w-(--measure-prose) space-y-4 border border-(--color-line) bg-(--color-surface) p-5">
      <p className="label">{question ? "Before you move on" : "Refresher"}</p>

      {question ? (
        <>
          <p className="text-(--color-fg)">{question.question}</p>
          <div className="flex flex-col gap-2">
            {question.options.map((option) => {
              const isChosen = chosen === option.id;
              const isAnswer = option.id === question.correctOptionId;
              const tone = !answered
                ? "border-(--color-line) hover:border-(--color-faint) hover:bg-(--color-raised)"
                : isAnswer
                  ? "border-(--color-deep)/60 bg-(--color-deep)/10 text-(--color-fg)"
                  : isChosen
                    ? "border-(--color-alert)/50 bg-(--color-alert)/10 text-(--color-fg)"
                    : "border-(--color-line) opacity-50";
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={answered}
                  onClick={() => setChosen(option.id)}
                  className={`border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default ${tone}`}
                >
                  {option.label}
                  {answered && isAnswer && <span className="ml-2 text-(--color-deep)">correct</span>}
                </button>
              );
            })}
          </div>
          {answered && (
            <div className="space-y-1 border-l-2 border-(--color-deep) pl-3">
              <p className="label">{chosen === question.correctOptionId ? "Right" : "Not quite"}</p>
              <div className="prose text-[0.95rem]">
                <Markdown text={question.explanation} />
              </div>
            </div>
          )}
        </>
      ) : (
        <ul className="space-y-2">
          {skills.map((skill) => (
            <li key={skill.slug} className="text-sm text-(--color-mist)">
              <span className="text-(--color-fg)">{skill.name}</span> — {skill.summary}
            </li>
          ))}
        </ul>
      )}

      {signedIn ? (
        // Only offered once the check has been engaged with, so completion
        // cannot be clicked past without reading anything.
        (!question || answered) && (
          <button type="button" onClick={onComplete} className="btn">
            {question ? "Got it — mark complete" : "I've got this"}
          </button>
        )
      ) : (
        <p className="text-sm text-(--color-mist)">
          Sign in to keep track of which chapters you have finished.
        </p>
      )}
    </div>
  );
}
