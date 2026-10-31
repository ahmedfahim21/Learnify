import { date, integer, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";

/**
 * Schema for Learnify on Supabase Postgres.
 *
 * Auth lives in Supabase's managed `auth` schema, which owns `auth.users`.
 * That table is deliberately NOT declared here: drizzle-kit manages only
 * `public` and must never generate DDL for a table the provider owns. So
 * `user_id` columns are plain uuids, and their foreign keys onto
 * `auth.users(id)` are declared in SQL (drizzle/0001_supabase_auth_rls.sql),
 * which also enables row-level security on every table.
 *
 * Lecture, transcript, study-pack, doubt and flashcard tables arrive with the
 * pipeline (PLAN.md steps 2–7).
 */

/**
 * Daily-habit streak per learner. `lastActiveDate` is the most recent day the
 * learner answered a check or reviewed a flashcard; `current` resets to 1 if a
 * day is skipped.
 */
export const streaks = pgTable("streaks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique(),
  current: integer("current").notNull().default(0),
  longest: integer("longest").notNull().default(0),
  // YYYY-MM-DD of the last day with activity (date mode keeps it tz-agnostic).
  lastActiveDate: date("last_active_date"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Per-user, per-day count of doubts asked.
 *
 * One row per (user, UTC day). A doubt is the per-student cost: lectures,
 * subtitles and study packs are cached per lecture and language and shared,
 * but every doubt is a fresh Sarvam call (speech-to-text plus an answer).
 *
 * Counted in its own table so the check before each doubt is a cheap
 * primary-key read rather than a count over the doubt history.
 */
export const generationUsage = pgTable(
  "generation_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    /** UTC day, so the window resets predictably regardless of timezone. */
    day: date("day").notNull(),
    used: integer("used").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("generation_usage_user_day_unique").on(table.userId, table.day)],
);

export type Streak = typeof streaks.$inferSelect;
export type NewStreak = typeof streaks.$inferInsert;
export type GenerationUsage = typeof generationUsage.$inferSelect;
