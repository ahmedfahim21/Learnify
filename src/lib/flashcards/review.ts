import { createHash } from "node:crypto";

import { and, asc, count, eq, gt, lte, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { type CardReview, cardReviews, streaks } from "@/db/schema";
import type { Lang } from "@/lib/languages";
import { initialScheduleState, schedule } from "@/lib/mastery/schedule";
import type { StudyPack } from "@/lib/study/pack";
import { dbPackDeps } from "@/lib/study/store";

/**
 * Flashcard review: stable card ids, SM-2 scheduling per student, the Today
 * queue, and the daily streak.
 */

export type Flashcard = StudyPack["flashcards"][number];
export type IdentifiedCard = Flashcard & { id: string };

/**
 * A card's id is a hash of its lecture, time and English front. Translated
 * packs keep the English order, so the same card has the same id in every
 * language, and review history survives switching languages.
 */
export function cardId(lectureId: string, english: Flashcard): string {
  return createHash("sha1").update(`${lectureId}\u0000${english.startSec.toFixed(1)}\u0000${english.front}`).digest("hex").slice(0, 16);
}

/** Attach ids to a pack's cards using the English pack's matching cards. */
export function identifyCards(lectureId: string, cards: Flashcard[], english: Flashcard[]): IdentifiedCard[] {
  return cards.map((c, n) => ({ ...c, id: cardId(lectureId, english[n] ?? c) }));
}

export const RATINGS = { again: 1, hard: 3, good: 4, easy: 5 } as const;
export type Rating = keyof typeof RATINGS;

/** Day key in IST: Indian students' "today" doesn't end at 05:30. */
export function dayKey(now: Date): string {
  return new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

export interface StreakState {
  current: number;
  longest: number;
  lastActiveDate: string | null;
}

/** Same day: unchanged. The day after: +1. Any gap: back to 1. */
export function nextStreak(prev: StreakState | null, today: string): StreakState {
  if (!prev || !prev.lastActiveDate) return { current: 1, longest: Math.max(1, prev?.longest ?? 0), lastActiveDate: today };
  if (prev.lastActiveDate === today) return prev;
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const current = prev.lastActiveDate === yesterday.toISOString().slice(0, 10) ? prev.current + 1 : 1;
  return { current, longest: Math.max(prev.longest, current), lastActiveDate: today };
}

export class UnknownCardError extends Error {
  constructor() {
    super("No such flashcard in this lecture.");
    this.name = "UnknownCardError";
  }
}

export interface ReviewResult {
  cardId: string;
  dueAt: Date;
  intervalDays: number;
  streak: number;
}

export async function reviewCard(
  userId: string,
  input: { lectureId: string; lang: Lang; cardId: string; rating: Rating },
  now: Date = new Date(),
): Promise<ReviewResult> {
  const [pack, english] = await Promise.all([
    dbPackDeps.getStored(input.lectureId, input.lang),
    input.lang === "en" ? null : dbPackDeps.getStored(input.lectureId, "en"),
  ]);
  if (!pack) throw new UnknownCardError();
  const cards = identifyCards(input.lectureId, pack.payload.flashcards, (english ?? pack).payload.flashcards);
  const card = cards.find((c) => c.id === input.cardId);
  if (!card) throw new UnknownCardError();

  const db = getDb();
  const [prior] = await db
    .select()
    .from(cardReviews)
    .where(and(eq(cardReviews.userId, userId), eq(cardReviews.cardId, card.id)));
  const next = schedule(prior ?? initialScheduleState(), RATINGS[input.rating], now);

  const values = {
    userId,
    lectureId: input.lectureId,
    cardId: card.id,
    lang: input.lang,
    front: card.front,
    back: card.back,
    startSec: card.startSec,
    repetitions: next.repetitions,
    intervalDays: next.intervalDays,
    easeFactor: next.easeFactor,
    dueAt: next.dueAt,
    lastReviewedAt: now,
    reviews: (prior?.reviews ?? 0) + 1,
  };
  await db
    .insert(cardReviews)
    .values(values)
    .onConflictDoUpdate({ target: [cardReviews.userId, cardReviews.cardId], set: values });

  const streak = await touchStreak(userId, now);
  return { cardId: card.id, dueAt: next.dueAt, intervalDays: next.intervalDays, streak: streak.current };
}

export async function touchStreak(userId: string, now: Date = new Date()): Promise<StreakState> {
  const db = getDb();
  const [row] = await db.select().from(streaks).where(eq(streaks.userId, userId));
  const next = nextStreak(row ?? null, dayKey(now));
  if (row && row.lastActiveDate === next.lastActiveDate) return next;
  await db
    .insert(streaks)
    .values({ userId, ...next })
    .onConflictDoUpdate({ target: streaks.userId, set: { ...next, updatedAt: sql`now()` } });
  return next;
}

export interface TodayView {
  due: Pick<CardReview, "cardId" | "lectureId" | "lang" | "front" | "back" | "startSec" | "reviews">[];
  /** Cards scheduled later, for "nothing due — next review in N days". */
  upcoming: number;
  nextDueAt: Date | null;
  streak: StreakState;
}

export async function today(userId: string, now: Date = new Date()): Promise<TodayView> {
  const db = getDb();
  const [due, [{ upcoming }], [next], [streak]] = await Promise.all([
    db
      .select({
        cardId: cardReviews.cardId,
        lectureId: cardReviews.lectureId,
        lang: cardReviews.lang,
        front: cardReviews.front,
        back: cardReviews.back,
        startSec: cardReviews.startSec,
        reviews: cardReviews.reviews,
      })
      .from(cardReviews)
      .where(and(eq(cardReviews.userId, userId), lte(cardReviews.dueAt, now)))
      .orderBy(asc(cardReviews.dueAt))
      .limit(50),
    db
      .select({ upcoming: count() })
      .from(cardReviews)
      .where(and(eq(cardReviews.userId, userId), gt(cardReviews.dueAt, now))),
    db
      .select({ dueAt: cardReviews.dueAt })
      .from(cardReviews)
      .where(and(eq(cardReviews.userId, userId), gt(cardReviews.dueAt, now)))
      .orderBy(asc(cardReviews.dueAt))
      .limit(1),
    db.select().from(streaks).where(eq(streaks.userId, userId)),
  ]);

  // A streak whose last day was before yesterday has lapsed, even before the next review resets it.
  let s: StreakState = streak ?? { current: 0, longest: 0, lastActiveDate: null };
  if (s.lastActiveDate) {
    const t = dayKey(now);
    const y = new Date(`${t}T00:00:00Z`);
    y.setUTCDate(y.getUTCDate() - 1);
    if (s.lastActiveDate !== t && s.lastActiveDate !== y.toISOString().slice(0, 10)) s = { ...s, current: 0 };
  }
  return { due, upcoming, nextDueAt: next?.dueAt ?? null, streak: s };
}
