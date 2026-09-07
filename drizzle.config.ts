import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Only read when running drizzle-kit commands that hit the database
    // (migrate/push/studio). `generate` works offline from the schema alone.
    url: process.env.DATABASE_URL ?? "",
  },
  // Neon Auth owns the `neon_auth` schema — its tables are declared in
  // schema.ts only so our foreign keys and queries are typed. Restricting
  // drizzle-kit to `public` stops it generating CREATE/ALTER/DROP for a
  // schema the database provider manages.
  schemaFilter: ["public"],
  strict: true,
  verbose: true,
} satisfies Config;
