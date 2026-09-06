import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { getDb } from "@/db";
import { authAccounts, authSessions, authVerifications, users } from "@/db/schema";

/**
 * Better Auth, pointed at the existing `users` table.
 *
 * Two deliberate choices:
 *
 * 1. Better Auth uses our `users` table as its `user` model rather than
 *    creating its own, so the app keeps a single user identity and every
 *    existing foreign key (topics, mastery, streaks, ...) stays valid. Its ids
 *    are generated as UUIDs to fit that column's type.
 * 2. Construction is lazy and memoised. `getDb()` throws without DATABASE_URL,
 *    and building the app imports modules — so an eagerly-constructed auth
 *    instance would make `next build` require a live database.
 */

/** Only register a provider once its credentials actually exist, so the app
 *  runs (and builds) with none, one, or both configured. */
function socialProviders() {
  const providers: Record<string, { clientId: string; clientSecret: string }> = {};
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    providers.github = {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    };
  }
  return providers;
}

/** Which providers the sign-in page should offer. Safe to call anywhere —
 *  it reads env presence only, never secrets. */
export function configuredProviders(): ("google" | "github")[] {
  return Object.keys(socialProviders()) as ("google" | "github")[];
}

// Wrapped in a factory so the precise generic type is inferred from the
// options object — annotating with betterAuth's default generic loses it.
function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: users,
        session: authSessions,
        account: authAccounts,
        verification: authVerifications,
      },
    }),
    socialProviders: socialProviders(),
    // The `users.id` column is a uuid, so ids minted for every model have to
    // be UUIDs too (the auth_* tables use text ids, which accept them fine).
    advanced: { database: { generateId: () => crypto.randomUUID() } },
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  });
}

let cached: ReturnType<typeof createAuth> | null = null;

export function getAuth(): ReturnType<typeof createAuth> {
  cached ??= createAuth();
  return cached;
}
