/**
 * Spaced-repetition scheduling — the SM-2-lite half of the mastery engine (#43).
 *
 * Given the prior scheduling state for a concept and the quality of the latest
 * answer (0–5), this computes the next review interval and `dueAt`:
 *   - quality < 3 (a lapse): reset the repetition count and re-show the concept
 *     the same day (~tonight), so the learner gets another pass soon;
 *   - quality ≥ 3: classic SM-2 interval growth (1d → 3d → ×easeFactor) with the
 *     easiness factor nudged by how cleanly the concept was recalled.
 *
 * Pure and deterministic for a fixed `now` — no DB, no clock side effects beyond
 * the injected `now` — so it's straightforward to test.
 */

import { clampQuality } from "./update";

export interface ScheduleState {
  /** Successful reviews in a row (resets to 0 on a lapse). */
  repetitions: number;
  /** Current inter-review interval, in days. */
  intervalDays: number;
  /** SM-2 easiness factor (≥ 1.3); larger ⇒ intervals grow faster. */
  easeFactor: number;
}

export interface ScheduleResult extends ScheduleState {
  /** Absolute time the concept next becomes due. */
  dueAt: Date;
}

export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3;
/** A lapsed concept comes back this many hours later (same day, "~tonight"). */
const LAPSE_HOURS = 8;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

/** Fresh scheduling state for a concept seen for the first time. */
export function initialScheduleState(): ScheduleState {
  return { repetitions: 0, intervalDays: 0, easeFactor: DEFAULT_EASE };
}

/** Classic SM-2 easiness-factor adjustment, floored at {@link MIN_EASE}. */
function adjustEase(ease: number, quality: number): number {
  const q = clampQuality(quality);
  const next = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  return Math.max(MIN_EASE, next);
}

/**
 * Compute the next scheduling state + `dueAt` from the prior state and the
 * latest graded quality.
 */
export function schedule(
  state: ScheduleState,
  quality: number,
  now: Date = new Date(),
): ScheduleResult {
  const q = clampQuality(quality);
  const ease = Number.isFinite(state.easeFactor) ? state.easeFactor : DEFAULT_EASE;

  // Lapse: reset reps and re-show the concept later today.
  if (q < 3) {
    return {
      repetitions: 0,
      intervalDays: 0,
      easeFactor: Math.max(MIN_EASE, ease),
      dueAt: new Date(now.getTime() + LAPSE_HOURS * MS_PER_HOUR),
    };
  }

  const nextEase = adjustEase(ease, q);
  const repetitions = Math.max(0, Math.floor(state.repetitions)) + 1;

  let intervalDays: number;
  if (repetitions === 1) {
    intervalDays = 1;
  } else if (repetitions === 2) {
    intervalDays = 3;
  } else {
    const prev = state.intervalDays > 0 ? state.intervalDays : 3;
    intervalDays = Math.round(prev * nextEase);
  }

  return {
    repetitions,
    intervalDays,
    easeFactor: nextEase,
    dueAt: new Date(now.getTime() + intervalDays * MS_PER_DAY),
  };
}
