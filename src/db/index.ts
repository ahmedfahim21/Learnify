import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

type Database = ReturnType<typeof drizzle<typeof schema>>;

let cached: Database | null = null;

/**
 * Lazily construct the Drizzle client over Supabase Postgres.
 *
 * `DATABASE_URL` is Supabase's transaction pooler (Supavisor, port 6543),
 * which suits serverless functions but doesn't support prepared statements —
 * hence `prepare: false`. Migrations use the direct connection instead (see
 * drizzle.config.ts).
 *
 * The connection is created on first use rather than at module load, so
 * importing this module (e.g. during `next build`) never requires
 * `DATABASE_URL`. It throws only when something actually tries to query.
 */
export function getDb(): Database {
  if (cached) return cached;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to your environment (see .env.example) before using the database.",
    );
  }

  const client = postgres(connectionString, { prepare: false });
  cached = drizzle(client, { schema });
  return cached;
}

export { schema };
