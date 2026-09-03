ALTER TABLE "concepts" ADD COLUMN "phase" text;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "kind" text DEFAULT 'custom' NOT NULL;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "problem_slug" text;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_user_problem_unique" UNIQUE("user_id","problem_slug");