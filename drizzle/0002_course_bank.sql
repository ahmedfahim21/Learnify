CREATE TABLE "courses" (
	"id" integer PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"professor" text NOT NULL,
	"institute" text NOT NULL,
	"discipline_id" integer NOT NULL,
	"discipline_name" text NOT NULL,
	"content_type" text NOT NULL,
	"human_langs" text[],
	"outline_fetched_at" timestamp with time zone,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lectures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" integer NOT NULL,
	"nptel_lesson_id" integer NOT NULL,
	"unit_name" text NOT NULL,
	"title" text NOT NULL,
	"youtube_id" text,
	"concepts_covered" text,
	"vtt_refs" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lectures_course_lesson_unique" UNIQUE("course_id","nptel_lesson_id")
);
--> statement-breakpoint
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "courses_discipline_idx" ON "courses" USING btree ("discipline_id");--> statement-breakpoint
-- Public catalog data, but still read through the app only (see 0001).
ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lectures" ENABLE ROW LEVEL SECURITY;
