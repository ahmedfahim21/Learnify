import type { Config } from "drizzle-kit";

/**
 * Supabase's direct connection (port 5432). Migrations need a session
 * connection; the transaction pooler in DATABASE_URL is for the app.
 *
 * Checked before any command that touches a database (migrate/push/studio),
 * so a stale or mis-pasted URL can't run DDL against some other database.
 * Errors name the problem but never echo the URL, which carries the password.
 * `generate` works offline from the schema alone and skips the check.
 */
function directUrl(): string {
  const command = process.argv.slice(2).find((a) => !a.startsWith("-"));
  const raw = process.env.DIRECT_URL ?? "";
  if (command === "generate" || command === "check") return raw;
  if (!raw) throw new Error("DIRECT_URL is not set. See .env.example.");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      `DIRECT_URL doesn't parse as a URL (${raw.length} characters loaded). If the password has # @ : / ? or quotes, wrap the value in double quotes and percent-encode the password.`,
    );
  }
  if (!/\.supabase\.(co|com)$/.test(url.hostname)) {
    throw new Error(`DIRECT_URL points at ${url.hostname}, not a Supabase host. Refusing to migrate.`);
  }
  return raw;
}

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: directUrl() },
  // Supabase owns the `auth` schema (auth.users). Restricting drizzle-kit to
  // `public` stops it generating CREATE/ALTER/DROP for a schema the provider
  // manages; the foreign keys onto auth.users are written in SQL instead.
  schemaFilter: ["public"],
  strict: true,
  verbose: true,
} satisfies Config;
