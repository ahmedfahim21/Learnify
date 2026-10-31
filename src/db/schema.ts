import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

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
 * Transcript, study-pack, doubt and flashcard tables arrive with the pipeline
 * (PLAN.md steps 3–7).
 */

/**
 * The NPTEL course bank, mirrored from nptel.ac.in/courses/__data.json by
 * scripts/nptelSync.ts. `id` is NPTEL's own course id. Courses with
 * contentType "Web" have no lectures to play and are kept out of browse.
 *
 * `outlineFetchedAt` is null until someone first opens the course; that's
 * when its lectures are fetched and stored (lib/courses/repo.ts).
 * `humanLangs` lists the Learnify language codes NPTEL has human subtitles
 * for, across at least half the course's lectures.
 */
export const courses = pgTable(
  "courses",
  {
    id: integer("id").primaryKey(),
    title: text("title").notNull(),
    professor: text("professor").notNull(),
    institute: text("institute").notNull(),
    disciplineId: integer("discipline_id").notNull(),
    disciplineName: text("discipline_name").notNull(),
    contentType: text("content_type").notNull(),
    humanLangs: text("human_langs").array(),
    outlineFetchedAt: timestamp("outline_fetched_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("courses_discipline_idx").on(table.disciplineId)],
);

/**
 * One NPTEL lesson. `vttRefs` maps NPTEL's language names ("English",
 * "Tamil", …) to the caption file reference — a Drive id or a SWAYAM gs://
 * path — for every track that exists. `youtubeId` is null for the rare lesson
 * NPTEL lists without a video; those aren't playable.
 */
export const lectures = pgTable(
  "lectures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    /** NPTEL's lesson id: a course-wide ordinal, so it also orders lectures. */
    nptelLessonId: integer("nptel_lesson_id").notNull(),
    unitName: text("unit_name").notNull(),
    title: text("title").notNull(),
    youtubeId: text("youtube_id"),
    conceptsCovered: text("concepts_covered"),
    vttRefs: jsonb("vtt_refs").$type<Record<string, string>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("lectures_course_lesson_unique").on(table.courseId, table.nptelLessonId)],
);

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
export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
export type Lecture = typeof lectures.$inferSelect;
export type NewLecture = typeof lectures.$inferInsert;
