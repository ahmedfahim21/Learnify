-- Move authentication to Neon's managed `neon_auth` schema.
--
-- Neon runs Better Auth as a hosted service and owns neon_auth.user, so the
-- app's own users/auth_* tables go away and every user_id foreign key is
-- repointed at Neon's table. The id type is uuid on both sides, so the
-- columns themselves are unchanged.
--
-- Destructive, deliberately: existing rows reference the old hardcoded
-- demo@learnify.local user, which has no counterpart in neon_auth.user. They
-- would violate the new foreign keys, so they are cleared first. At the time
-- of writing that is 1 user, 3 topics and 2 tutoring sessions, all local test
-- data; mastery, streaks and course_progress were already empty.
DELETE FROM "session_events";--> statement-breakpoint
DELETE FROM "review_events";--> statement-breakpoint
DELETE FROM "mastery";--> statement-breakpoint
DELETE FROM "streaks";--> statement-breakpoint
DELETE FROM "learner_notes";--> statement-breakpoint
DELETE FROM "course_progress";--> statement-breakpoint
DELETE FROM "sessions";--> statement-breakpoint
DELETE FROM "concept_edges";--> statement-breakpoint
DELETE FROM "concepts";--> statement-breakpoint
DELETE FROM "topics";--> statement-breakpoint

-- CASCADE also drops every foreign key that referenced these tables, so the
-- old constraints need no separate DROP statements.
DROP TABLE IF EXISTS "auth_accounts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "auth_sessions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "auth_verifications" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "users" CASCADE;--> statement-breakpoint

-- Repoint every user_id at Neon's managed table. These are declared here
-- rather than in schema.ts because drizzle-kit manages only the `public`
-- schema — it must never emit DDL for a table the provider owns.
ALTER TABLE "topics" ADD CONSTRAINT "topics_user_id_neon_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_neon_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "mastery" ADD CONSTRAINT "mastery_user_id_neon_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_user_id_neon_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_user_id_neon_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "learner_notes" ADD CONSTRAINT "learner_notes_user_id_neon_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_user_id_neon_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade;
