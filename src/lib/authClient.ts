"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import type { SocialProvider } from "./auth";

/** Browser-side Supabase Auth. Sessions live in cookies the server can read. */

let client: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error("Supabase is not configured. See .env.example.");
  client ??= createBrowserClient(url, publishableKey);
  return client;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

function toSessionUser(user: User): SessionUser {
  const meta = user.user_metadata as { full_name?: string; name?: string; avatar_url?: string };
  return {
    id: user.id,
    email: user.email ?? "",
    name: meta.full_name ?? meta.name ?? null,
    image: meta.avatar_url ?? null,
  };
}

export async function signIn(provider: SocialProvider, next: string): Promise<void> {
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const { error } = await supabase().auth.signInWithOAuth({ provider, options: { redirectTo } });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase().auth.signOut();
  if (error) throw error;
}

/** The signed-in user, kept in sync with sign-in and sign-out in any tab. */
export function useSession(): { user: SessionUser | null; isPending: boolean } {
  const [state, setState] = useState<{ user: SessionUser | null; isPending: boolean }>({
    user: null,
    isPending: true,
  });

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setState({ user: null, isPending: false });
      return;
    }
    const auth = supabase().auth;
    auth.getUser().then(({ data }) => {
      setState({ user: data.user ? toSessionUser(data.user) : null, isPending: false });
    });
    const { data } = auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ? toSessionUser(session.user) : null, isPending: false });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return state;
}
