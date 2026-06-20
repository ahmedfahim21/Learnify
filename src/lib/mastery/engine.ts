import { and, asc, eq, gte, lt, lte, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  concepts,
  mastery,
  reviewEvents,
  streaks,
  topics,
} from "@/db/schema";

import {
  decayedScore,
  isEvidenceKind,
  updateScore,
  type EvidenceKind,
} from "./update";
import { initialScheduleState, schedule } from "./schedule";

/**
 * The DB-facing mastery engine (#43): turn a piece of graded evidence into a
 * mastery update + spaced-repetition reschedule, and read back the surfaces the
 * Today dashboard and review sessions need.
 *
 * `applyEvidence` is the single write path — the `/turn` route calls it for both
 * server-graded checks (MCQ/ordering/matching) and the tutor's `record_evidence`
 * (flashcard/free-text/self-report). It's idempotent in shape (one row per
 * user+concept) and also keeps the denormalised `concepts.mastery` (used by the
 * knowledge-graph view) in sync.
 */

export { isEvidenceKind, type EvidenceKind } from "./update";

export interface EvidenceInput {
  userId: string;
  /** The session's topic — used to resolve `conceptSlug` to a concept row. */
  topicId: string;
  /** The concept this evidence is about (slug within the topic), if known. */
  conceptSlug?: string | null;
  kind: EvidenceKind;
  /** Graded quality, 0–5. */
  quality: number;
  sessionId?: string | null;
}

export interface EvidenceResult {
  conceptId: string;
  conceptName: string;
  /** Updated 0–1 mastery. */
  newScore: number;
  dueAt: Date;
}

/**
 * Apply one piece of evidence: update the concept's EMA score, reschedule it,
 * append a review-event audit row, sync `concepts.mastery`, and bump the streak.
 *
 * Returns `null` (a no-op) when the evidence can't be tied to a concept — e.g.
 * the tutor didn't tag the check with a `conceptSlug`, or the slug doesn't match
 * a concept in this topic. The caller treats that as "nothing recorded".
 */
export async function applyEvidence(
  input: EvidenceInput,
): Promise<EvidenceResult | null> {
  const slug = input.conceptSlug?.trim();
  if (!slug || !isEvidenceKind(input.kind)) return null;

  const db = getDb();
  const now = new Date();

  // Resolve the concept within the session's topic.
  const [concept] = await db
    .select({ id: concepts.id, name: concepts.name })
    .from(concepts)
    .where(and(eq(concepts.topicId, input.topicId), eq(concepts.slug, slug)))
    .limit(1);
  if (!concept) return null;

  // Load the prior mastery row (if any) to compute the next state.
  const [existing] = await db
    .select()
    .from(mastery)
    .where(
      and(eq(mastery.userId, input.userId), eq(mastery.conceptId, concept.id)),
    )
    .limit(1);

  const prevScore = existing?.score ?? 0;
  const priorState = existing
    ? {
        repetitions: existing.repetitions,
        intervalDays: existing.intervalDays,
        easeFactor: existing.easeFactor,
      }
    : initialScheduleState();

  const newScore = updateScore(prevScore, input.kind, input.quality);
  const sched = schedule(priorState, input.quality, now);

  // Upsert the mastery row (one per user+concept).
  await db
    .insert(mastery)
    .values({
      userId: input.userId,
      conceptId: concept.id,
      score: newScore,
      repetitions: sched.repetitions,
      intervalDays: sched.intervalDays,
      easeFactor: sched.easeFactor,
      evidenceCount: 1,
      lastReviewedAt: now,
      dueAt: sched.dueAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [mastery.userId, mastery.conceptId],
      set: {
        score: newScore,
        repetitions: sched.repetitions,
        intervalDays: sched.intervalDays,
        easeFactor: sched.easeFactor,
        evidenceCount: sql`${mastery.evidenceCount} + 1`,
        lastReviewedAt: now,
        dueAt: sched.dueAt,
        updatedAt: now,
      },
    });

  // Audit trail.
  await db.insert(reviewEvents).values({
    userId: input.userId,
    conceptId: concept.id,
    sessionId: input.sessionId ?? null,
    kind: input.kind,
    quality: input.quality,
    scoreBefore: prevScore,
    scoreAfter: newScore,
    dueAt: sched.dueAt,
  });

  // Keep the knowledge-graph view's denormalised mastery in sync.
  await db
    .update(concepts)
    .set({ mastery: newScore })
    .where(eq(concepts.id, concept.id));

  await touchStreak(input.userId, now);

  return {
    conceptId: concept.id,
    conceptName: concept.name,
    newScore,
    dueAt: sched.dueAt,
  };
}

/** YYYY-MM-DD for a date (UTC), matching the `date` column's storage. */
function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Record activity for `today`, advancing or resetting the learner's streak:
 *   - already active today → no change;
 *   - active yesterday → streak + 1 (and a new longest, if so);
 *   - otherwise → streak resets to 1.
 */
export async function touchStreak(userId: string, now: Date = new Date()): Promise<void> {
  const db = getDb();
  const today = isoDay(now);
  const yesterday = isoDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  const [existing] = await db
    .select()
    .from(streaks)
    .where(eq(streaks.userId, userId))
    .limit(1);

  if (!existing) {
    await db.insert(streaks).values({
      userId,
      current: 1,
      longest: 1,
      lastActiveDate: today,
      updatedAt: now,
    });
    return;
  }

  if (existing.lastActiveDate === today) return; // already counted today

  const current = existing.lastActiveDate === yesterday ? existing.current + 1 : 1;
  const longest = Math.max(existing.longest, current);

  await db
    .update(streaks)
    .set({ current, longest, lastActiveDate: today, updatedAt: now })
    .where(eq(streaks.userId, userId));
}

export interface DueConcept {
  conceptId: string;
  conceptSlug: string;
  conceptName: string;
  topicId: string;
  topicTitle: string;
  /** Stored 0–1 mastery. */
  score: number;
  /** Forgetting-curve-decayed score for display. */
  displayScore: number;
  dueAt: string;
}

export interface StreakInfo {
  current: number;
  longest: number;
  /** True if the learner has already produced evidence today. */
  activeToday: boolean;
}

export interface TodaySnapshot {
  due: DueConcept[];
  weak: DueConcept[];
  streak: StreakInfo;
}

/** A `mastery ⋈ concepts ⋈ topics` projection, shared by the Today queries. */
function joinedSelection() {
  return {
    conceptId: concepts.id,
    conceptSlug: concepts.slug,
    conceptName: concepts.name,
    topicId: topics.id,
    topicTitle: topics.title,
    score: mastery.score,
    lastReviewedAt: mastery.lastReviewedAt,
    dueAt: mastery.dueAt,
  };
}

type JoinedRow = {
  conceptId: string;
  conceptSlug: string;
  conceptName: string;
  topicId: string;
  topicTitle: string;
  score: number;
  lastReviewedAt: Date | null;
  dueAt: Date | null;
  evidenceCount?: number;
};

function toDueConcept(row: JoinedRow, now: Date): DueConcept {
  return {
    conceptId: row.conceptId,
    conceptSlug: row.conceptSlug,
    conceptName: row.conceptName,
    topicId: row.topicId,
    topicTitle: row.topicTitle,
    score: row.score,
    displayScore: decayedScore(row.score, row.lastReviewedAt, now),
    dueAt: (row.dueAt ?? now).toISOString(),
  };
}

/**
 * Everything the `/today` dashboard needs: the due queue (`dueAt <= now`),
 * weak concepts (decayed score < 0.5 with enough evidence to trust), and the
 * learner's streak.
 */
export async function getTodaySnapshot(
  userId: string,
  now: Date = new Date(),
): Promise<TodaySnapshot> {
  const db = getDb();

  const dueRows = await db
    .select(joinedSelection())
    .from(mastery)
    .innerJoin(concepts, eq(mastery.conceptId, concepts.id))
    .innerJoin(topics, eq(concepts.topicId, topics.id))
    .where(and(eq(mastery.userId, userId), lte(mastery.dueAt, now)))
    .orderBy(asc(mastery.dueAt));

  // Weak concepts: enough evidence to trust, and still below the 0.5 line once
  // forgetting decay is applied. Pull then filter by decayed score in JS.
  const weakRows = await db
    .select({ ...joinedSelection(), evidenceCount: mastery.evidenceCount })
    .from(mastery)
    .innerJoin(concepts, eq(mastery.conceptId, concepts.id))
    .innerJoin(topics, eq(concepts.topicId, topics.id))
    .where(
      and(
        eq(mastery.userId, userId),
        gte(mastery.evidenceCount, 2),
        lt(mastery.score, 0.5),
      ),
    )
    .orderBy(asc(mastery.score));

  const [streakRow] = await db
    .select()
    .from(streaks)
    .where(eq(streaks.userId, userId))
    .limit(1);

  const today = isoDay(now);

  return {
    due: dueRows.map((row) => toDueConcept(row, now)),
    weak: weakRows.map((row) => toDueConcept(row, now)),
    streak: {
      current: streakRow?.current ?? 0,
      longest: streakRow?.longest ?? 0,
      activeToday: streakRow?.lastActiveDate === today,
    },
  };
}
