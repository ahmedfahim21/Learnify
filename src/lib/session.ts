import { isAuthConfigured, getSupabase } from "./auth";

/**
 * The signed-in user, or null.
 *
 * Watching a lecture is public; only things that belong to someone (doubts,
 * flashcard reviews, check history) require a user, and they say so with a
 * 401 rather than falling back to a shared account.
 */
export interface CurrentUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isAuthConfigured()) return null;
  const { data, error } = await (await getSupabase()).auth.getUser();
  // No session cookie is the ordinary signed-out case; anything else is real.
  if (error && error.name !== "AuthSessionMissingError") throw error;
  const user = data.user;
  if (!user) return null;
  const meta = user.user_metadata as { full_name?: string; name?: string; avatar_url?: string };
  return {
    id: user.id,
    name: meta.full_name ?? meta.name ?? null,
    email: user.email ?? "",
    image: meta.avatar_url ?? null,
  };
}

export async function getCurrentUserId(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}

/** For API routes: the user id, or a 401 to return. Keeps every protected
 *  route's unauthenticated branch identical instead of ad-hoc per route. */
export async function requireUserId(): Promise<
  { userId: string; response?: never } | { userId?: never; response: Response }
> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return {
      response: Response.json({ error: "Sign in to continue." }, { status: 401 }),
    };
  }
  return { userId };
}
