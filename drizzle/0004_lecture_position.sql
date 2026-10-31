-- Lectures are keyed by their place in NPTEL's outline, because NPTEL's lesson
-- ids aren't unique within a course. Stored lectures are a cache of NPTEL's
-- outline with no user data hanging off them yet, so they're cleared and
-- refetched on next open rather than backfilled.
DELETE FROM "lectures";--> statement-breakpoint
UPDATE "courses" SET "outline_fetched_at" = NULL, "human_langs" = NULL;--> statement-breakpoint
ALTER TABLE "lectures" DROP CONSTRAINT "lectures_course_lesson_unique";--> statement-breakpoint
ALTER TABLE "lectures" ADD COLUMN "position" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_course_position_unique" UNIQUE("course_id","position");