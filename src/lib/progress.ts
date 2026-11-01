import { and, avg, count, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { courses, lectures, quizAttempts } from "@/db/schema";
import { isLang } from "@/lib/languages";
import { touchStreak } from "@/lib/streaks";

/**
 * A student's study record: finished quizzes, and the activity that keeps the
 * daily streak going. Read by the profile and the course page.
 */

/** Longest quiz the generator writes is 10; a little room, never unbounded. */
const MAX_QUESTIONS = 20;

export const attemptSchema = z
  .object({
    lectureId: z.uuid(),
    lang: z.string().refine(isLang, "Unsupported language."),
    variant: z.enum(["simpler", "standard", "harder"]),
    score: z.number().int().min(0),
    total: z.number().int().min(1).max(MAX_QUESTIONS),
    points: z.number().int().min(0).max(MAX_QUESTIONS * 15),
    bestStreak: z.number().int().min(0),
  })
  .strict()
  .refine((a) => a.score <= a.total, { message: "score can't exceed total", path: ["score"] })
  .refine((a) => a.bestStreak <= a.score, { message: "bestStreak can't exceed score", path: ["bestStreak"] });

export type AttemptInput = z.infer<typeof attemptSchema>;

export interface SavedAttempt extends AttemptInput {
  id: string;
  createdAt: string;
}

/** Store a finished quiz and count it toward the streak. */
export async function recordQuiz(userId: string, attempt: AttemptInput): Promise<{ attempt: SavedAttempt; streak: number }> {
  const [row] = await getDb()
    .insert(quizAttempts)
    .values({ userId, ...attempt })
    .returning();
  const streak = await touchStreak(userId);
  return {
    attempt: {
      id: row.id,
      lectureId: row.lectureId,
      lang: row.lang as AttemptInput["lang"],
      variant: row.variant as AttemptInput["variant"],
      score: row.score,
      total: row.total,
      points: row.points,
      bestStreak: row.bestStreak,
      createdAt: row.createdAt.toISOString(),
    },
    streak: streak.current,
  };
}

export interface RecentQuiz {
  lectureId: string;
  lectureTitle: string;
  courseTitle: string;
  lang: string;
  score: number;
  total: number;
  createdAt: string;
}

export interface QuizSummary {
  taken: number;
  /** Mean of each attempt's score ÷ total, as a whole percentage; null before the first. */
  averagePct: number | null;
  recent: RecentQuiz[];
}

export async function quizSummary(userId: string, limit = 8): Promise<QuizSummary> {
  const db = getDb();
  const [[totals], recent] = await Promise.all([
    db
      .select({ taken: count(), mean: avg(sql<number>`${quizAttempts.score}::float / ${quizAttempts.total}`) })
      .from(quizAttempts)
      .where(eq(quizAttempts.userId, userId)),
    db
      .select({
        lectureId: quizAttempts.lectureId,
        lectureTitle: lectures.title,
        courseTitle: courses.title,
        lang: quizAttempts.lang,
        score: quizAttempts.score,
        total: quizAttempts.total,
        createdAt: quizAttempts.createdAt,
      })
      .from(quizAttempts)
      .innerJoin(lectures, eq(lectures.id, quizAttempts.lectureId))
      .innerJoin(courses, eq(courses.id, lectures.courseId))
      .where(eq(quizAttempts.userId, userId))
      .orderBy(desc(quizAttempts.createdAt))
      .limit(limit),
  ]);
  return {
    taken: totals.taken,
    averagePct: totals.mean === null ? null : Math.round(Number(totals.mean) * 100),
    recent: recent.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  };
}

/** The student's best score on each lecture they've quizzed on, among `lectureIds`. */
export async function bestScores(userId: string, lectureIds: string[]): Promise<Record<string, { score: number; total: number }>> {
  if (lectureIds.length === 0) return {};
  const rows = await getDb()
    .select({ lectureId: quizAttempts.lectureId, score: quizAttempts.score, total: quizAttempts.total })
    .from(quizAttempts)
    .where(and(eq(quizAttempts.userId, userId), inArray(quizAttempts.lectureId, lectureIds)));
  return pickBest(rows);
}

/** Highest score ÷ total per lecture; a tie keeps the longer quiz. */
export function pickBest(rows: { lectureId: string; score: number; total: number }[]): Record<string, { score: number; total: number }> {
  const best: Record<string, { score: number; total: number }> = {};
  for (const r of rows) {
    const b = best[r.lectureId];
    const better = !b || r.score / r.total > b.score / b.total || (r.score / r.total === b.score / b.total && r.total > b.total);
    if (better) best[r.lectureId] = { score: r.score, total: r.total };
  }
  return best;
}

/** Study that isn't stored on its own (reading a lecture's notes) still counts toward the streak. */
export const ACTIVITIES = ["notes"] as const;
export const activitySchema = z.object({ kind: z.enum(ACTIVITIES), lectureId: z.uuid() }).strict();

export async function recordActivity(userId: string): Promise<{ streak: number }> {
  return { streak: (await touchStreak(userId)).current };
}
