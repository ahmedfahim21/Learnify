import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { users } from "@/db/schema";

/**
 * Phase-1 stand-in for authentication.
 *
 * Until Better Auth lands (#47), every request acts as one hardcoded demo
 * learner. This resolves that user's id, creating the row on first use. The
 * insert is race-safe (`onConflictDoNothing` on the unique email) so concurrent
 * requests can't duplicate it.
 */
const DEMO_EMAIL = "demo@learnify.local";
const DEMO_NAME = "Demo Learner";

export async function getDemoUserId(): Promise<string> {
  const db = getDb();
  await db
    .insert(users)
    .values({ email: DEMO_EMAIL, name: DEMO_NAME })
    .onConflictDoNothing({ target: users.email });

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEMO_EMAIL))
    .limit(1);

  return user.id;
}
