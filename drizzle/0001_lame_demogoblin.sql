ALTER TABLE "sessions" ADD COLUMN "plan" jsonb;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "input_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "output_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "cache_read_tokens" integer DEFAULT 0 NOT NULL;