import { createHash } from "node:crypto";

import { and, asc, count, eq, gt, lte } from "drizzle-orm";

import { getDb } from "@/db";
import { type CardReview, cardReviews, streaks } from "@/db/schema";
import { asOf, type StreakState, touchStreak } from "@/lib/streaks";
import type { Lang } from "@/lib/languages";
import { initialScheduleState, schedule } from "@/lib/mastery/schedule";
import type { StudyPack } from "@/lib/study/pack";
import { dbPackDeps } from "@/lib/study/store";

/**
 * Flashcard review: stable card ids, SM-2 scheduling per student, and the
 * queue of cards due. Reviewing a card counts toward the streak (lib/streaks).
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

  return { due, upcoming, nextDueAt: next?.dueAt ?? null, streak: asOf(streak ?? null, now) };
}
