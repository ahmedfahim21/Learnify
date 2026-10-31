import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import type { StudyPack } from "@/lib/study/pack";

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
 * Study-pack, doubt and flashcard tables arrive with the pipeline (PLAN.md
 * steps 5–7).
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
    /** Place on the landing page's featured shelf (1 = first); null if not featured. Set by scripts/warmFeatured.ts. */
    featuredRank: integer("featured_rank"),
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
    /** 0-based place in NPTEL's outline: the key and the order. */
    position: integer("position").notNull(),
    /**
     * NPTEL's lesson id. Usually a course-wide ordinal, but not unique: Basic
     * Calculus (111106146) restarts at 1 for an appended "Live Session" unit.
     */
    nptelLessonId: integer("nptel_lesson_id").notNull(),
    unitName: text("unit_name").notNull(),
    title: text("title").notNull(),
    youtubeId: text("youtube_id"),
    conceptsCovered: text("concepts_covered"),
    vttRefs: jsonb("vtt_refs").$type<Record<string, string>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("lectures_course_position_unique").on(table.courseId, table.position)],
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
/**
 * A lecture's subtitles in one language, as sentence segments with seconds.
 * A row exists only once the track is complete; in-progress and failed work
 * is tracked by the job that builds it, not here.
 *
 * `source` says where the words came from: `nptel` (NPTEL's own caption file,
 * human-made for Indic languages), `youtube` (the video's caption track, when
 * NPTEL's file is missing), or `sarvam` (machine-translated from English;
 * `model` names the translator). Translated segments keep the English
 * segments' `i` and timestamps.
 */
export const transcripts = pgTable(
  "transcripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lectureId: uuid("lecture_id")
      .notNull()
      .references(() => lectures.id, { onDelete: "cascade" }),
    lang: text("lang").notNull(),
    source: text("source").$type<"nptel" | "youtube" | "sarvam">().notNull(),
    segments: jsonb("segments").$type<{ i: number; startSec: number; endSec: number; text: string }[]>().notNull(),
    durationSec: real("duration_sec").notNull(),
    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("transcripts_lecture_lang_unique").on(table.lectureId, table.lang)],
);

/**
 * One stage of preparing a lecture in a language: `transcript` (subtitles) or
 * `pack` (study material). The row is the lock and the progress report:
 *
 * - claimed by inserting it, by rebuilding a `done` row whose output is gone,
 *   or by taking over a `running` row whose
 *   heartbeat went stale (its function was killed) or a `failed` row under the
 *   attempt limit — each a single conditional statement (lib/jobs/claim.ts);
 * - `claimToken` changes on every claim, and heartbeats and the final write
 *   only land while it still matches, so a runner that wakes up late can't
 *   overwrite whoever took over;
 * - `partial` holds segments a translation has finished, so a takeover
 *   resumes instead of starting over.
 *
 * The built output lives in `transcripts` / `study_packs`; this row only
 * says how getting there went.
 */
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lectureId: uuid("lecture_id")
      .notNull()
      .references(() => lectures.id, { onDelete: "cascade" }),
    lang: text("lang").notNull(),
    stage: text("stage").$type<"transcript" | "pack">().notNull(),
    status: text("status").$type<"running" | "done" | "failed">().notNull(),
    claimToken: uuid("claim_token").notNull(),
    attempts: integer("attempts").notNull().default(1),
    progress: jsonb("progress").$type<{ done: number; total: number }>(),
    partial: jsonb("partial").$type<Record<string, string>>(),
    error: text("error"),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("jobs_lecture_lang_stage_unique").on(table.lectureId, table.lang, table.stage),
    index("jobs_created_at_idx").on(table.createdAt),
  ],
);

/**
 * A lecture's study pack in one language (see lib/study/pack.ts). English is
 * generated from the transcript; other languages are translations of the
 * English with the same ids, timestamps and answer keys. Bumping
 * STUDY_PROMPT_VERSION makes new packs without touching old rows.
 */
export const studyPacks = pgTable(
  "study_packs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lectureId: uuid("lecture_id")
      .notNull()
      .references(() => lectures.id, { onDelete: "cascade" }),
    lang: text("lang").notNull(),
    promptVersion: integer("prompt_version").notNull(),
    payload: jsonb("payload").$type<StudyPack>().notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("study_packs_lecture_lang_version_unique").on(table.lectureId, table.lang, table.promptVersion)],
);

/**
 * A student's doubt and its answer. `answer` is OpenUI Lang (rendered with
 * the doubt library), stored only once validated; a doubt we couldn't answer
 * is kept as `failed` with the reason, and its budget unit refunded.
 */
export const doubts = pgTable(
  "doubts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    lectureId: uuid("lecture_id")
      .notNull()
      .references(() => lectures.id, { onDelete: "cascade" }),
    lang: text("lang").notNull(),
    atSec: real("at_sec").notNull(),
    question: text("question").notNull(),
    status: text("status").$type<"answered" | "failed">().notNull(),
    answer: text("answer"),
    error: text("error"),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("doubts_user_lecture_idx").on(table.userId, table.lectureId, table.createdAt)],
);

/**
 * A student's spaced-repetition state for one flashcard (SM-2, see
 * lib/mastery/schedule.ts), plus a snapshot of the card in the language they
 * reviewed it in, so Today can show due cards without rebuilding packs.
 * `cardId` is stable across languages and pack rebuilds (lib/flashcards/ids.ts).
 */
export const cardReviews = pgTable(
  "card_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    lectureId: uuid("lecture_id")
      .notNull()
      .references(() => lectures.id, { onDelete: "cascade" }),
    cardId: text("card_id").notNull(),
    lang: text("lang").notNull(),
    front: text("front").notNull(),
    back: text("back").notNull(),
    startSec: real("start_sec").notNull(),
    repetitions: integer("repetitions").notNull().default(0),
    intervalDays: real("interval_days").notNull().default(0),
    easeFactor: real("ease_factor").notNull().default(2.5),
    reviews: integer("reviews").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("card_reviews_user_card_unique").on(table.userId, table.cardId),
    index("card_reviews_user_due_idx").on(table.userId, table.dueAt),
  ],
);

/**
 * A study screen the model generated for a lecture: interactive notes or a
 * practice quiz, in one language and one style (`variant`), as OpenUI Lang.
 * Shared by every student; "new quiz" / "simpler" / "harder" replace or add
 * a row. Stored only once it parses against the screen library.
 */
export const generatedScreens = pgTable(
  "generated_screens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lectureId: uuid("lecture_id")
      .notNull()
      .references(() => lectures.id, { onDelete: "cascade" }),
    lang: text("lang").notNull(),
    kind: text("kind").$type<"notes" | "quiz">().notNull(),
    variant: text("variant").$type<"standard" | "simpler" | "harder">().notNull(),
    program: text("program").notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("generated_screens_key_unique").on(table.lectureId, table.lang, table.kind, table.variant)],
);

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
export type Lecture = typeof lectures.$inferSelect;
export type NewLecture = typeof lectures.$inferInsert;
export type Transcript = typeof transcripts.$inferSelect;
export type NewTranscript = typeof transcripts.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type StudyPackRow = typeof studyPacks.$inferSelect;
/**
 * How a student wants to learn, set once on their first lecture and editable
 * after: the language screens are written in, what they're here for (which
 * study mode opens first), how hard to pitch it (which screen variant), and
 * whether checks pause the video. One row per user.
 */
export const learnerPreferences = pgTable("learner_preferences", {
  userId: uuid("user_id").primaryKey(),
  lang: text("lang").notNull(),
  goal: text("goal").notNull(),
  level: text("level").notNull(),
  checks: boolean("checks").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NewStudyPackRow = typeof studyPacks.$inferInsert;
export type Doubt = typeof doubts.$inferSelect;
export type NewDoubt = typeof doubts.$inferInsert;
export type CardReview = typeof cardReviews.$inferSelect;
export type GeneratedScreen = typeof generatedScreens.$inferSelect;
export type LearnerPreferencesRow = typeof learnerPreferences.$inferSelect;
