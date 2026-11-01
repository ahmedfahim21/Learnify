import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { streaks } from "@/db/schema";

/**
 * The daily study streak. Any study counts: reviewing a flashcard, finishing
 * a quiz or a lecture's notes, answering a check, or asking a doubt. Each
 * calls `touchStreak`; a second activity on the same day changes nothing.
 */

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

/** The streak as of `now`: one whose last day was before yesterday has lapsed, even before the next activity resets it. */
export function asOf(row: StreakState | null, now: Date = new Date()): StreakState {
  const s: StreakState = row ?? { current: 0, longest: 0, lastActiveDate: null };
  if (!s.lastActiveDate) return s;
  const t = dayKey(now);
  const y = new Date(`${t}T00:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  return s.lastActiveDate !== t && s.lastActiveDate !== y.toISOString().slice(0, 10) ? { ...s, current: 0 } : s;
}
