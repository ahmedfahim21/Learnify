-- Supabase-specific DDL that drizzle-kit doesn't manage.
--
-- 1. Foreign keys onto auth.users. Supabase owns the `auth` schema, so these
--    live here rather than in schema.ts (drizzle-kit is restricted to `public`).
--
-- 2. Row-level security on every table, with no policies. Supabase exposes
--    `public` over PostgREST to anyone holding the anon key, which ships in the
--    browser bundle. RLS with no policies denies all of that; the app reads and
--    writes only through its own API routes, connected as the database owner,
--    which bypasses RLS. Every new table must be added below —
--    src/db/rls.test.ts fails if one is missing.
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "generation_usage" ADD CONSTRAINT "generation_usage_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "streaks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "generation_usage" ENABLE ROW LEVEL SECURITY;
