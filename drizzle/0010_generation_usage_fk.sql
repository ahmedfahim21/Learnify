-- Same cross-schema foreign key as every other user_id column: declared here
-- rather than in schema.ts because drizzle-kit manages only the `public`
-- schema and must not emit DDL for Neon's `neon_auth.user`.
--
-- ON DELETE CASCADE so a deleted account's usage rows go with it.
ALTER TABLE "generation_usage" ADD CONSTRAINT "generation_usage_user_id_neon_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade;
