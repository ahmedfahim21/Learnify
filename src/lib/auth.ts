import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase Auth, server side.
 *
 * OAuth providers and their secrets live in the Supabase dashboard, so no
 * client secret ever reaches this repo or its environment. The URL and
 * publishable key are public by design; the secret key is never used.
 */

export function supabaseEnv(): { url: string; publishableKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set. See .env.example.",
    );
  }
  return { url, publishableKey };
}

/** Whether auth is configured at all, so UI can say so instead of failing. */
export function isAuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

/** A per-request Supabase client bound to this request's auth cookies. */
export async function getSupabase() {
  const { url, publishableKey } = supabaseEnv();
  const store = await cookies();
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        // Server components can't write cookies; middleware refreshes the
        // session on every navigation, so a write skipped here isn't lost.
        for (const { name, value, options } of toSet) {
          try {
            store.set(name, value, options);
          } catch (err) {
            if (!(err instanceof Error) || !/Server Action or Route Handler/.test(err.message)) throw err;
          }
        }
      },
    },
  });
}

export const SOCIAL_PROVIDERS = ["google", "github"] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

/**
 * Which providers the sign-in page offers, read from the project's public
 * auth settings so the page never shows a button that can only fail.
 */
export async function configuredProviders(): Promise<SocialProvider[]> {
  const { url, publishableKey } = supabaseEnv();
  const res = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: publishableKey },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Supabase auth settings returned HTTP ${res.status}`);
  const settings = (await res.json()) as { external?: Record<string, boolean> };
  return SOCIAL_PROVIDERS.filter((p) => settings.external?.[p] === true);
}
