ALTER TABLE "courses" ADD COLUMN "caption_share" real;--> statement-breakpoint
-- Courses already opened: work it out from the lectures stored for them.
UPDATE "courses" SET "caption_share" = s.share
FROM (
	SELECT "course_id", avg(CASE WHEN "youtube_id" IS NOT NULL AND "vtt_refs" ? 'English' THEN 1 ELSE 0 END)::real AS share
	FROM "lectures" GROUP BY "course_id"
) s
WHERE "courses"."id" = s."course_id";--> statement-breakpoint
UPDATE "courses" SET "caption_share" = 0 WHERE "outline_fetched_at" IS NOT NULL AND "caption_share" IS NULL;
