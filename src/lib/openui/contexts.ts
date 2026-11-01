"use client";

import { createContext } from "react";

/**
 * The two contexts OpenUI components read, kept in a module of their own so
 * the lecture page can provide them without importing the component
 * libraries (OpenUI, React Flow), which load on demand.
 */

/** Seeking the lecture video, clamped to its length. */
export interface LectureClock {
  durationSec: number;
  seekTo: (sec: number) => void;
}

export const LectureClockContext = createContext<LectureClock | null>(null);

export type Rating = "again" | "hard" | "good" | "easy";

export interface QuizResult {
  score: number;
  total: number;
  points: number;
  bestStreak: number;
  /** Added by the screen wrapper, which knows which style is showing. */
  variant?: "simpler" | "standard" | "harder";
}

/**
 * What a signed-in student's study saves. Provided only when they're signed
 * in, so nothing promises to save where it couldn't.
 * - `rate`: a flashcard rating; resolves to when the card is next due.
 * - `quizFinished`: a finished quiz, stored for the profile; resolves to the streak.
 * - `notesFinished`: the last chapter of a lecture's notes reached; counts toward the streak.
 */
export interface StudyActions {
  rate: (cardId: string, rating: Rating) => Promise<{ dueAt: string }>;
  quizFinished: (result: QuizResult) => Promise<{ streak: number }>;
  notesFinished: () => Promise<void>;
}

export const StudyActionsContext = createContext<StudyActions | null>(null);

/** Moving between study modes from inside a screen: the notes end by offering the quiz. */
export const StudyNavContext = createContext<((mode: "notes" | "quiz" | "cards" | "map") => void) | null>(null);
