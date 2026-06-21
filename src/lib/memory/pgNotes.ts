import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { learnerNotes } from "@/db/schema";

import type { LearnerMemory, MemoryRecord } from "./index";

/**
 * Plain-Postgres fallback for {@link LearnerMemory} (#44).
 *
 * Used when `SUPERMEMORY_API_KEY` is unset, so the app runs end-to-end with no
 * external memory service. There are no embeddings here, so `recall` ignores the
 * semantic `query` and simply returns the learner's most recent notes (newest
 * first) — "all notes into the prompt", capped at `k`. That's enough for the
 * demo: a handful of distilled insights per learner comfortably fits the
 * snapshot, and the most recent insights are the most relevant.
 */
export function createPgNotesMemory(): LearnerMemory {
  return {
    async remember(userId: string, insight: string): Promise<void> {
      const content = insight.trim();
      if (!content) return;
      await getDb().insert(learnerNotes).values({ userId, content });
    },

    async recall(
      userId: string,
      _query: string,
      k = 5,
    ): Promise<MemoryRecord[]> {
      const limit = Math.max(1, k);
      const rows = await getDb()
        .select({ id: learnerNotes.id, content: learnerNotes.content })
        .from(learnerNotes)
        .where(eq(learnerNotes.userId, userId))
        .orderBy(desc(learnerNotes.createdAt))
        .limit(limit);
      return rows.map((r) => ({ id: r.id, content: r.content }));
    },

    async forget(userId: string): Promise<void> {
      await getDb().delete(learnerNotes).where(eq(learnerNotes.userId, userId));
    },
  };
}
