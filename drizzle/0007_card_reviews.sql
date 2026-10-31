CREATE TABLE "card_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lecture_id" uuid NOT NULL,
	"card_id" text NOT NULL,
	"lang" text NOT NULL,
	"front" text NOT NULL,
	"back" text NOT NULL,
	"start_sec" real NOT NULL,
	"repetitions" integer DEFAULT 0 NOT NULL,
	"interval_days" real DEFAULT 0 NOT NULL,
	"ease_factor" real DEFAULT 2.5 NOT NULL,
	"reviews" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"last_reviewed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "card_reviews_user_card_unique" UNIQUE("user_id","card_id")
);
--> statement-breakpoint
ALTER TABLE "card_reviews" ADD CONSTRAINT "card_reviews_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "public"."lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_reviews_user_due_idx" ON "card_reviews" USING btree ("user_id","due_at");--> statement-breakpoint
ALTER TABLE "card_reviews" ADD CONSTRAINT "card_reviews_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "card_reviews" ENABLE ROW LEVEL SECURITY;
