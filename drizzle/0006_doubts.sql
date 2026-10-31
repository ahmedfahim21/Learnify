CREATE TABLE "doubts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lecture_id" uuid NOT NULL,
	"lang" text NOT NULL,
	"at_sec" real NOT NULL,
	"question" text NOT NULL,
	"status" text NOT NULL,
	"answer" text,
	"error" text,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "doubts" ADD CONSTRAINT "doubts_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "doubts_user_lecture_idx" ON "doubts" USING btree ("user_id","lecture_id","created_at");--> statement-breakpoint
ALTER TABLE "doubts" ADD CONSTRAINT "doubts_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "doubts" ENABLE ROW LEVEL SECURITY;
