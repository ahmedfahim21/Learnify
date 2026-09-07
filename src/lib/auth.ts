import { createNeonAuth } from "@neondatabase/auth/next/server";

/**
 * Neon's Managed Better Auth.
 *
 * Neon hosts the auth server and owns the `neon_auth` schema; this module only
 * holds the client that talks to it. That's the whole reason the previous
 * self-hosted Better Auth setup (its own config, adapter, and three auth_*
 * tables) is gone — it's the same library, run by the database provider.
 *
 * OAuth providers are configured in the Neon Console rather than here, so no
 * client secrets ever reach this repo or its environment.
 *
 * Built lazily and memoised: the cookie secret is only present at runtime, and
 * an eagerly-constructed instance would make `next build` require it.
 */
function createAuth() {
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  if (!secret || !baseUrl) {
    throw new Error(
      "NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET must be set. See .env.example.",
    );
  }
  return createNeonAuth({ baseUrl, cookies: { secret } });
}

let cached: ReturnType<typeof createAuth> | null = null;

export function getAuth(): ReturnType<typeof createAuth> {
  cached ??= createAuth();
  return cached;
}

/** Whether auth is configured at all, so UI can say so instead of failing. */
export function isAuthConfigured(): boolean {
  return Boolean(process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET);
}

export const SOCIAL_PROVIDERS = ["google", "github"] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

/**
 * Which providers the sign-in page offers.
 *
 * Neon holds the OAuth credentials in its Console and exposes no endpoint to
 * enumerate what's enabled, so this can't be detected — it's declared with
 * NEON_AUTH_PROVIDERS instead, and must match the Console. Listing a provider
 * that isn't configured there renders a button that can only fail.
 */
export function configuredProviders(): SocialProvider[] {
  const raw = process.env.NEON_AUTH_PROVIDERS;
  if (!raw) return [...SOCIAL_PROVIDERS];
  const wanted = raw.split(",").map((p) => p.trim().toLowerCase());
  return SOCIAL_PROVIDERS.filter((p) => wanted.includes(p));
}
