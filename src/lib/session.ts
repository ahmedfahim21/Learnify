import { getAuth } from "./auth";

/**
 * The signed-in user, or null.
 *
 * This replaces the old `getDemoUserId()`. Reading a course stays public —
 * it's static content and touches no database — so only the things that
 * genuinely belong to someone (progress, tutoring sessions, the mastery
 * queue) require a user, and they say so with a 401 rather than silently
 * falling back to a shared account.
 */
export interface CurrentUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Neon's server SDK reads the session cookie from the request context
  // itself, and throws rather than returning null when there is none.
  try {
    const result = await getAuth().getSession();
    const user = result?.data?.user;
    if (!user) return null;
    return {
      id: user.id,
      name: user.name ?? null,
      email: user.email,
      image: user.image ?? null,
    };
  } catch {
    return null;
  }
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
