import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { generationUsage } from "@/db/schema";

/**
 * Daily cap on doubts per user.
 *
 * Doubts are the one per-student cost: everything else about a lecture is
 * generated once and cached for every student. This caps doubts per user per
 * UTC day so one account can't run up an arbitrary bill. Subtitles, checks
 * and study screens stay available when the cap is reached.
 */

export const DEFAULT_DAILY_LIMIT = 20;

export function dailyLimit(): number {
  const raw = Number(process.env.DOUBT_DAILY_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_DAILY_LIMIT;
}

/** UTC day key, so the window resets at a predictable instant for everyone. */
export function currentDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export interface BudgetState {
  used: number;
  limit: number;
  remaining: number;
  exceeded: boolean;
}

export async function getBudget(userId: string, now: Date = new Date()): Promise<BudgetState> {
  const [row] = await getDb()
    .select({ used: generationUsage.used })
    .from(generationUsage)
    .where(and(eq(generationUsage.userId, userId), eq(generationUsage.day, currentDay(now))))
    .limit(1);

  const limit = dailyLimit();
  const used = row?.used ?? 0;
  return { used, limit, remaining: Math.max(0, limit - used), exceeded: used >= limit };
}

/**
 * Consume one doubt, or report that the budget is spent.
 *
 * The increment is a single atomic upsert rather than read-then-write, so two
 * doubts racing can't both read the same count and each spend the last unit.
 * The limit is enforced inside the statement's WHERE, which is what makes the
 * check and the spend one operation.
 */
export async function consumeDoubt(
  userId: string,
  now: Date = new Date(),
): Promise<{ allowed: boolean; state: BudgetState }> {
  const limit = dailyLimit();
  const day = currentDay(now);

  const updated = await getDb()
    .insert(generationUsage)
    .values({ userId, day, used: 1 })
    .onConflictDoUpdate({
      target: [generationUsage.userId, generationUsage.day],
      set: { used: sql`${generationUsage.used} + 1`, updatedAt: new Date() },
      where: sql`${generationUsage.used} < ${limit}`,
    })
    .returning({ used: generationUsage.used });

  if (updated.length === 0) {
    // The conflict WHERE rejected the increment: already at the limit.
    return { allowed: false, state: { used: limit, limit, remaining: 0, exceeded: true } };
  }

  const used = updated[0].used;
  return {
    allowed: true,
    state: { used, limit, remaining: Math.max(0, limit - used), exceeded: used >= limit },
  };
}

/**
 * Give a doubt back when we failed to answer it (Sarvam down, invalid answer),
 * so a student isn't charged for our failure. Never goes below zero.
 */
export async function refundDoubt(userId: string, now: Date = new Date()): Promise<void> {
  await getDb()
    .update(generationUsage)
    .set({ used: sql`greatest(${generationUsage.used} - 1, 0)`, updatedAt: new Date() })
    .where(and(eq(generationUsage.userId, userId), eq(generationUsage.day, currentDay(now))));
}
