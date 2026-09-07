import type { DesignPhase } from "./types";

/**
 * Pre-generated quiz content.
 *
 * Every course ships a full quiz written by hand, so the practice experience
 * costs nothing to run, works signed out, and stays available when a learner
 * has spent their daily generative-UI budget. The adaptive tutor is the
 * upgrade over this, not a replacement for it.
 */
export interface QuizQuestion {
  id: string;
  /** Which chapter the question comes from — used to group the result review. */
  phase: DesignPhase;
  question: string;
  options: { id: string; label: string }[];
  correctOptionId: string;
  /** Shown after answering, whichever option was chosen. */
  explanation: string;
}

export type QuizBank = Record<string, QuizQuestion[]>;
