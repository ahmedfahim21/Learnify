CREATE TABLE "learner_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"lang" text NOT NULL,
	"goal" text NOT NULL,
	"level" text NOT NULL,
	"checks" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "learner_preferences" ADD CONSTRAINT "learner_preferences_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "learner_preferences" ENABLE ROW LEVEL SECURITY;
