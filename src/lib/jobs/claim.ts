import { randomUUID } from "node:crypto";

import { and, eq, gte, lt, or, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { type Job, jobs } from "@/db/schema";
import type { Lang } from "@/lib/languages";

/**
 * Claiming, heartbeating and finishing a lecture-preparation stage.
 *
 * Every write is one statement, so it's atomic on its own without a
 * transaction: two requests racing for the same stage can't both win.
 */

export type Stage = Job["stage"];

/** A running job with no heartbeat for this long is presumed dead and can be taken over. */
export const STALE_AFTER_SEC = 90;
/** A failed stage is retried on a later request, up to this many attempts in all. */
export const MAX_ATTEMPTS = 3;
/** …but not before this long has passed, so polling can't hammer a struggling Sarvam. */
export const RETRY_COOLDOWN_SEC = 30;

export interface Claim {
  job: Job;
  token: string;
}

export type ClaimResult = { claimed: true; claim: Claim } | { claimed: false; job: Job };

export async function claimStage(lectureId: string, lang: Lang, stage: Stage): Promise<ClaimResult> {
  const db = getDb();
  const token = randomUUID();

  const [inserted] = await db
    .insert(jobs)
    .values({ lectureId, lang, stage, status: "running", claimToken: token })
    .onConflictDoNothing()
    .returning();
  if (inserted) return { claimed: true, claim: { job: inserted, token } };

  // A `done` job is only claimed when its output is missing (callers check
  // first): a prompt-version bump or deleted rows. Rebuild it as a fresh run.
  const [rebuilt] = await db
    .update(jobs)
    .set({
      status: "running",
      claimToken: token,
      attempts: 1,
      error: null,
      partial: null,
      progress: null,
      heartbeatAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(jobs.lectureId, lectureId), eq(jobs.lang, lang), eq(jobs.stage, stage), eq(jobs.status, "done")))
    .returning();
  if (rebuilt) return { claimed: true, claim: { job: rebuilt, token } };

  const stale = sql`now() - make_interval(secs => ${STALE_AFTER_SEC})`;
  const [taken] = await db
    .update(jobs)
    .set({
      status: "running",
      claimToken: token,
      attempts: sql`${jobs.attempts} + 1`,
      error: null,
      heartbeatAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(jobs.lectureId, lectureId),
        eq(jobs.lang, lang),
        eq(jobs.stage, stage),
        lt(jobs.attempts, MAX_ATTEMPTS),
        or(
          and(eq(jobs.status, "running"), lt(jobs.heartbeatAt, stale)),
          and(eq(jobs.status, "failed"), lt(jobs.updatedAt, sql`now() - make_interval(secs => ${RETRY_COOLDOWN_SEC})`)),
        ),
      ),
    )
    .returning();
  if (taken) return { claimed: true, claim: { job: taken, token } };

  const [current] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.lectureId, lectureId), eq(jobs.lang, lang), eq(jobs.stage, stage)));
  if (!current) throw new Error(`job ${lectureId}/${lang}/${stage} vanished between insert and read`);
  return { claimed: false, job: current };
}

/** Thrown when another runner has taken the job over; the stale runner must stop. */
export class LostClaimError extends Error {
  constructor(jobId: string) {
    super(`lost the claim on job ${jobId}`);
    this.name = "LostClaimError";
  }
}

async function ownedUpdate(claim: Claim, set: Partial<typeof jobs.$inferInsert>): Promise<void> {
  const [row] = await getDb()
    .update(jobs)
    .set({ ...set, heartbeatAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(jobs.id, claim.job.id), eq(jobs.claimToken, claim.token), eq(jobs.status, "running")))
    .returning({ id: jobs.id });
  if (!row) throw new LostClaimError(claim.job.id);
}

/** Keep the claim alive, optionally saving progress and finished translation segments. */
export function heartbeat(
  claim: Claim,
  update: { progress?: { done: number; total: number }; partial?: Record<string, string> } = {},
): Promise<void> {
  return ownedUpdate(claim, update);
}

export function finish(claim: Claim): Promise<void> {
  return ownedUpdate(claim, { status: "done", partial: null, error: null });
}

/**
 * Record a failed stage. A transient failure (Sarvam rate-limiting us) doesn't
 * use up one of the stage's attempts: it says nothing about whether the stage
 * can succeed, only that it should wait. The cooldown still applies.
 */
export async function fail(claim: Claim, error: string, opts: { transient?: boolean } = {}): Promise<void> {
  // Recorded even if the claim was lost meanwhile, as long as nobody finished it.
  await getDb()
    .update(jobs)
    .set({
      status: "failed",
      error: error.slice(0, 2000),
      updatedAt: sql`now()`,
      ...(opts.transient ? { attempts: sql`greatest(${jobs.attempts} - 1, 0)` } : {}),
    })
    .where(and(eq(jobs.id, claim.job.id), eq(jobs.claimToken, claim.token)));
}

/** Sarvam's rate limit, however deep in a wrapped error message it surfaced. */
export function isRateLimited(message: string): boolean {
  return /HTTP 429|rate limit/i.test(message);
}

export async function jobsFor(lectureId: string, lang: Lang): Promise<Job[]> {
  return getDb()
    .select()
    .from(jobs)
    .where(and(eq(jobs.lectureId, lectureId), or(eq(jobs.lang, lang), eq(jobs.lang, "en"))));
}

/** Stages started across all lectures since UTC midnight, for the global daily cap. */
export async function stagesStartedToday(now: Date = new Date()): Promise<number> {
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(jobs)
    .where(gte(jobs.createdAt, midnight));
  return row?.n ?? 0;
}
