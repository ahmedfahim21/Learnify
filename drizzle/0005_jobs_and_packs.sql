CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lecture_id" uuid NOT NULL,
	"lang" text NOT NULL,
	"stage" text NOT NULL,
	"status" text NOT NULL,
	"claim_token" uuid NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"progress" jsonb,
	"partial" jsonb,
	"error" text,
	"heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_lecture_lang_stage_unique" UNIQUE("lecture_id","lang","stage")
);
--> statement-breakpoint
CREATE TABLE "study_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lecture_id" uuid NOT NULL,
	"lang" text NOT NULL,
	"prompt_version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_packs_lecture_lang_version_unique" UNIQUE("lecture_id","lang","prompt_version")
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_packs" ADD CONSTRAINT "study_packs_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_created_at_idx" ON "jobs" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "study_packs" ENABLE ROW LEVEL SECURITY;
