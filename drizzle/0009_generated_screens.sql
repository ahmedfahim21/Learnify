CREATE TABLE "generated_screens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lecture_id" uuid NOT NULL,
	"lang" text NOT NULL,
	"kind" text NOT NULL,
	"variant" text NOT NULL,
	"program" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generated_screens_key_unique" UNIQUE("lecture_id","lang","kind","variant")
);
--> statement-breakpoint
ALTER TABLE "generated_screens" ADD CONSTRAINT "generated_screens_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_screens" ENABLE ROW LEVEL SECURITY;
