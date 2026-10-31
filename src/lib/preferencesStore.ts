import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { learnerPreferences } from "@/db/schema";

import { type Preferences, preferencesSchema } from "./preferences";

/** Server-side storage for learning preferences; one row per user. */

export interface PreferencesDeps {
  get: (userId: string) => Promise<Preferences | null>;
  put: (userId: string, prefs: Preferences) => Promise<Preferences>;
}

export const dbPreferences: PreferencesDeps = {
  get: async (userId) => {
    const [row] = await getDb().select().from(learnerPreferences).where(eq(learnerPreferences.userId, userId));
    if (!row) return null;
    // A row is only ever written through preferencesSchema; a bad one is a bug, not a default.
    const parsed = preferencesSchema.parse({ lang: row.lang, goal: row.goal, level: row.level, checks: row.checks });
    return parsed as Preferences;
  },
  put: async (userId, prefs) => {
    await getDb()
      .insert(learnerPreferences)
      .values({ userId, ...prefs })
      .onConflictDoUpdate({ target: learnerPreferences.userId, set: { ...prefs, updatedAt: sql`now()` } });
    return prefs;
  },
};
