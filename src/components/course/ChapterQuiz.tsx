"use client";

import { useState } from "react";

import { Markdown } from "../classroom/Markdown";

/**
 * A self-graded comprehension check embedded in a course chapter.
 *
 * Deliberately not wired to the tutor or the mastery engine: it's a
 * "did that land?" beat in the middle of reading, graded locally and
 * instantly. Once answered the choice locks, so it reads as a checkpoint
 * rather than something to fiddle with.
 */
export function ChapterQuiz({
  question,
  options,
  correctOptionId,
  explanation,
}: {
  question: string;
  options: { id: string; label: string }[];
  correctOptionId: string;
  explanation: string;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const answered = chosen !== null;
  const correct = chosen === correctOptionId;

  return (
    <div className="max-w-(--measure-prose) space-y-3 border border-(--color-line) bg-(--color-surface) p-5">
      <p className="label">Check yourself</p>
      <p className="text-(--color-fg)">{question}</p>

      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const isChosen = chosen === option.id;
          const isAnswer = option.id === correctOptionId;
          // After answering, mark the right answer regardless of what was
          // picked — being shown the correct option is the teaching moment.
          const tone = !answered
            ? "border-(--color-line) hover:border-(--color-faint) hover:bg-(--color-raised)"
            : isAnswer
              ? "border-(--color-signal)/60 bg-(--color-signal)/10 text-(--color-fg)"
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
              {answered && isAnswer && <span className="ml-2 text-(--color-signal)">correct</span>}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="space-y-1 border-l-2 border-(--color-signal) pl-3">
          <p className="label">{correct ? "Right" : "Not quite"}</p>
          <div className="prose text-[0.95rem]">
            <Markdown text={explanation} />
          </div>
        </div>
      )}
    </div>
  );
}
