import {
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

/**
 * Phase-1 schema for Learnify 2.0.
 *
 * Intentionally minimal: enough to run a single live tutoring session for a
 * hardcoded demo user. The mastery engine, concept graph, memory and source
 * tables arrive in later phases (see issue #50).
 */

/** Learners. Phase 1 seeds a single hardcoded demo user. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A subject the user wants to learn, e.g. "Fourier transforms". */
export const topics = pgTable("topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  /**
   * Concept-graph lifecycle: a topic is decomposed into a prerequisite DAG of
   * concepts once, asynchronously, after it's created (#42).
   *   "new"         — created, not yet decomposed
   *   "decomposing" — a decomposition run is in flight
   *   "ready"       — concepts + edges are persisted and renderable
   *   "failed"      — decomposition failed; can be retried
   */
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * A single concept within a topic's prerequisite graph.
 *
 * Concepts are produced by one structured-output decomposition call
 * (`generateConceptGraph`) and persisted in topological order (`orderIndex`),
 * so a layout pass and "teach in order" both have a stable spine. `mastery` is
 * a 0–1 score the mastery engine (#43) updates after sessions; the graph view
 * colours nodes by it (defaults to 0 = not started).
 */
export const concepts = pgTable(
  "concepts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    // Stable, URL-safe identifier unique within the topic; how edges and the
    // tutor's plan reference a concept.
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    summary: text("summary").notNull(),
    // 1 (foundational) … 5 (advanced).
    difficulty: integer("difficulty").notNull().default(1),
    // Topological rank within the topic (0 = no prerequisites).
    orderIndex: integer("order_index").notNull().default(0),
    // 0–1 mastery; populated by the mastery engine (#43).
    mastery: real("mastery").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique("concepts_topic_slug_unique").on(table.topicId, table.slug)],
);

/**
 * A prerequisite edge in a topic's concept DAG: `from` must be learned before
 * `to`. Cycles and back-edges are dropped server-side before insert, so the
 * stored edge set is always a valid DAG.
 */
export const conceptEdges = pgTable(
  "concept_edges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    fromConceptId: uuid("from_concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "cascade" }),
    toConceptId: uuid("to_concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "cascade" }),
  },
  (table) => [
    unique("concept_edges_unique").on(
      table.topicId,
      table.fromConceptId,
      table.toConceptId,
    ),
  ],
);

/** A single live tutoring session against a topic. */
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  topicId: uuid("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  /**
   * Session kind: "learn" (default — teach the topic/selected concepts) or
   * "review" (#43 — spaced-repetition pass seeded from the due queue; the tutor
   * runs flashcard-heavy with short explanations unless the learner struggles).
   */
  kind: text("kind").notNull().default("learn"),
  // "active" | "completed" | "abandoned"
  status: text("status").notNull().default("active"),
  /**
   * The tutor's running session plan: `{ phase, remainingConceptIds }`, updated
   * via the `update_plan` tool so a resumed turn knows where it left off.
   */
  plan: jsonb("plan"),
  /**
   * Per-session token ledger, accumulated from streaming usage across every
   * Bedrock call. `cacheReadTokens > 0` on multi-turn sessions is the caching
   * discipline assertion (#41).
   */
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

/**
 * Append-only transcript of everything that happened in a session: tutor
 * turns, emitted A2UI blocks, and user interactions. `seq` is monotonic and
 * unique per session so events can be replayed deterministically.
 */
export const sessionEvents = pgTable(
  "session_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    // "tutor_message" | "a2ui_block" | "user_action" | "system"
    type: text("type").notNull(),
    // "tutor" | "user" | "system"
    role: text("role").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique("session_events_session_seq_unique").on(table.sessionId, table.seq)],
);

/**
 * Per-learner mastery of a concept — the retention moat (#43).
 *
 * One row per (user, concept). `score` is a 0–1 exponential moving average over
 * graded evidence (see `lib/mastery/update`); the SM-2-lite fields
 * (`repetitions`, `intervalDays`, `easeFactor`, `dueAt`) drive spaced-repetition
 * scheduling (see `lib/mastery/schedule`). The `(userId, dueAt)` index powers
 * the Today due queue.
 */
export const mastery = pgTable(
  "mastery",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conceptId: uuid("concept_id")
      .notNull()
      .references(() => concepts.id, { onDelete: "cascade" }),
    // 0–1 EMA over evidence quality.
    score: real("score").notNull().default(0),
    // SM-2-lite scheduling state.
    repetitions: integer("repetitions").notNull().default(0),
    intervalDays: real("interval_days").notNull().default(0),
    easeFactor: real("ease_factor").notNull().default(2.5),
    // How many pieces of evidence have updated this row (gates "weak" surfacing).
    evidenceCount: integer("evidence_count").notNull().default(0),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    // When this concept next becomes due for review.
    dueAt: timestamp("due_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("mastery_user_concept_unique").on(table.userId, table.conceptId),
    index("mastery_user_due_idx").on(table.userId, table.dueAt),
  ],
);

/**
 * Append-only audit trail of every mastery update: what kind of evidence, the
 * graded quality, and the score/schedule before and after. Useful for debugging
 * the engine and (later) charting progress over time.
 */
export const reviewEvents = pgTable("review_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  conceptId: uuid("concept_id")
    .notNull()
    .references(() => concepts.id, { onDelete: "cascade" }),
  // The session this evidence came from, if any (nulled if the session is gone).
  sessionId: uuid("session_id").references(() => sessions.id, {
    onDelete: "set null",
  }),
  // "mcq" | "ordering" | "matching" | "flashcard" | "free_text" | "self_report"
  kind: text("kind").notNull(),
  // Graded quality 0–5.
  quality: real("quality").notNull(),
  scoreBefore: real("score_before").notNull(),
  scoreAfter: real("score_after").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Daily-habit streak per learner. `lastActiveDate` is the most recent day the
 * learner produced mastery evidence; `current` resets to 1 if a day is skipped.
 */
export const streaks = pgTable("streaks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
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
 * Plain-Postgres fallback for the tutor's qualitative memory of *how* a learner
 * learns (#44). When `SUPERMEMORY_API_KEY` is unset, distilled insights
 * (learning style, interests, misconceptions, what worked) land here instead of
 * Supermemory; the read path pulls a learner's recent notes into the session
 * snapshot. Notes are user-scoped and cascade-deleted with the account.
 */
export const learnerNotes = pgTable(
  "learner_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("learner_notes_user_idx").on(table.userId, table.createdAt)],
);

/**
 * A learning source attached to a topic (#45): a PDF, web article, or YouTube
 * video. "Learn from anything" — teaching is grounded in the learner's own
 * sources (with citations, #46) instead of model weights alone.
 *
 * Lifecycle mirrors the topic decomposition flow:
 *   "pending"   — created, ingestion not started
 *   "ingesting" — fetch/parse/chunk in flight
 *   "ready"     — text extracted into ordered `source_chunks`
 *   "failed"    — ingestion failed; `error` carries a friendly reason and the
 *                 source can be retried (or, for YouTube, a transcript pasted)
 *
 * `tokenEstimate` is the rough token cost of feeding this source into a session
 * (≈ chars / 4); the per-topic budget (`MAX_TOPIC_SOURCE_TOKENS`) is enforced
 * against the sum of ready sources. PDFs additionally live in Vercel Blob
 * (`blobUrl`) so their bytes can be base64'd into requests at session time —
 * Bedrock has no Files API or URL document sources (#45 context).
 */
export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  topicId: uuid("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  // "pdf" | "url" | "youtube"
  kind: text("kind").notNull(),
  // Display label: filename, article title, or video title.
  title: text("title").notNull(),
  // Original URL for url/youtube sources; null for uploaded PDFs.
  sourceUrl: text("source_url"),
  // Vercel Blob URL for an uploaded PDF; re-fetched + base64'd at session time.
  blobUrl: text("blob_url"),
  // "pending" | "ingesting" | "ready" | "failed"
  status: text("status").notNull().default("pending"),
  // Human-readable failure reason when status = "failed".
  error: text("error"),
  // Rough token cost of this source's text (≈ chars / 4), for the topic budget.
  tokenEstimate: integer("token_estimate").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * One ordered chunk of a source's extracted text, carrying the citation
 * metadata the grounded-teaching UX (#46) jumps to: `{ page }` for PDFs,
 * `{ heading }` for articles, `{ startSec, endSec }` for YouTube transcripts.
 * `idx` is monotonic within a source so chunks reassemble in reading order.
 */
export const sourceChunks = pgTable(
  "source_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    content: text("content").notNull(),
    // Citation locator; shape depends on source kind (see above).
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique("source_chunks_source_idx_unique").on(table.sourceId, table.idx)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
export type Concept = typeof concepts.$inferSelect;
export type NewConcept = typeof concepts.$inferInsert;
export type ConceptEdge = typeof conceptEdges.$inferSelect;
export type NewConceptEdge = typeof conceptEdges.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type SessionEvent = typeof sessionEvents.$inferSelect;
export type NewSessionEvent = typeof sessionEvents.$inferInsert;
export type Mastery = typeof mastery.$inferSelect;
export type NewMastery = typeof mastery.$inferInsert;
export type ReviewEvent = typeof reviewEvents.$inferSelect;
export type NewReviewEvent = typeof reviewEvents.$inferInsert;
export type Streak = typeof streaks.$inferSelect;
export type NewStreak = typeof streaks.$inferInsert;
export type LearnerNote = typeof learnerNotes.$inferSelect;
export type NewLearnerNote = typeof learnerNotes.$inferInsert;
export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type SourceChunk = typeof sourceChunks.$inferSelect;
export type NewSourceChunk = typeof sourceChunks.$inferInsert;
