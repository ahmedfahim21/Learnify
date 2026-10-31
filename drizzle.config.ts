import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Supabase's direct connection (port 5432). Migrations need a session
    // connection; the transaction pooler in DATABASE_URL is for the app.
    // Only read by commands that hit the database (migrate/push/studio);
    // `generate` works offline from the schema alone.
    url: process.env.DIRECT_URL ?? "",
  },
  // Supabase owns the `auth` schema (auth.users). Restricting drizzle-kit to
  // `public` stops it generating CREATE/ALTER/DROP for a schema the provider
  // manages; the foreign keys onto auth.users are written in SQL instead.
  schemaFilter: ["public"],
  strict: true,
  verbose: true,
} satisfies Config;
