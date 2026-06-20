/**
 * Mastery scoring — the EMA half of the mastery engine (#43).
 *
 * A concept's mastery is a 0–1 exponential moving average over graded evidence.
 * Each piece of evidence nudges the score toward the normalized quality `q/5`,
 * weighted by how diagnostic that kind of interaction is (a free-text answer
 * tells us more than a self-reported flashcard rating). The functions here are
 * pure — no DB, no Bedrock — so they're trivially testable and build-safe.
 */

/** The kinds of evidence the engine can score. Mirrors `record_evidence`. */
export type EvidenceKind =
  | "mcq"
  | "ordering"
  | "matching"
  | "flashcard"
  | "free_text"
  | "self_report";

/**
 * How much each kind moves the score (the EMA learning rate). More diagnostic
 * interactions get more weight; a self-reported rating is the noisiest signal.
 */
export const KIND_WEIGHTS: Record<EvidenceKind, number> = {
  mcq: 0.3,
  ordering: 0.35,
  matching: 0.3,
  flashcard: 0.25,
  free_text: 0.4,
  self_report: 0.1,
};

/** Default weight for an unrecognised kind (treated like a flashcard). */
const DEFAULT_WEIGHT = 0.25;

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Clamp a graded quality into the 0–5 range. */
export function clampQuality(quality: number): number {
  if (!Number.isFinite(quality)) return 0;
  return Math.min(5, Math.max(0, quality));
}

export function isEvidenceKind(value: unknown): value is EvidenceKind {
  return (
    typeof value === "string" && Object.prototype.hasOwnProperty.call(KIND_WEIGHTS, value)
  );
}

/**
 * EMA update: `score' = clamp01(score + w[kind]·(q/5 − score))`.
 *
 * @param prevScore the concept's current 0–1 mastery
 * @param kind      what produced the evidence
 * @param quality   graded quality, 0–5
 */
export function updateScore(
  prevScore: number,
  kind: EvidenceKind,
  quality: number,
): number {
  const weight = KIND_WEIGHTS[kind] ?? DEFAULT_WEIGHT;
  const prev = clamp01(prevScore);
  const target = clampQuality(quality) / 5;
  return clamp01(prev + weight * (target - prev));
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Forgetting-curve decay rate per day, as specified in #43. */
const DECAY_PER_DAY = 0.02;

/**
 * Apply forgetting-curve decay for the Today view: `score·e^(−0.02·daysSince)`.
 * Mastery stored in the DB is *not* decayed (it only changes on real evidence);
 * decay is a display-time estimate of how much would have faded since the last
 * review, so a concept left untouched gradually slips toward "needs review".
 */
export function decayedScore(
  score: number,
  lastReviewedAt: Date | string | null | undefined,
  now: Date = new Date(),
): number {
  const base = clamp01(score);
  if (!lastReviewedAt) return base;
  const last =
    lastReviewedAt instanceof Date ? lastReviewedAt : new Date(lastReviewedAt);
  const days = Math.max(0, (now.getTime() - last.getTime()) / MS_PER_DAY);
  return clamp01(base * Math.exp(-DECAY_PER_DAY * days));
}
