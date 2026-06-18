import {
  integer,
  jsonb,
  pgTable,
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
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A single live tutoring session against a topic. */
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  topicId: uuid("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type SessionEvent = typeof sessionEvents.$inferSelect;
export type NewSessionEvent = typeof sessionEvents.$inferInsert;
