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

/**
 * Rating flashcards. Provided only when the student is signed in, so rating
 * buttons never appear where they couldn't be saved. `rate` resolves to when
 * the card is next due.
 */
export const StudyActionsContext = createContext<{
  rate: (cardId: string, rating: Rating) => Promise<{ dueAt: string }>;
} | null>(null);
