import Supermemory from "supermemory";

import type { LearnerMemory, MemoryRecord } from "./index";

/**
 * Supermemory-backed {@link LearnerMemory} (#44).
 *
 * Each learner's memories are isolated by a per-user container tag, so `recall`
 * only ever returns the current learner's insights and a demo reset can wipe
 * exactly their container. The SDK client is constructed lazily (on first use)
 * so importing this module never touches the network — `next build` and lint
 * pass with no key set.
 *
 * Chosen automatically by {@link getLearnerMemory} when `SUPERMEMORY_API_KEY` is
 * present; otherwise the plain-Postgres fallback (`pgNotes`) is used.
 */

/** Per-learner container tag. Alphanumeric + hyphens/underscores/dots only. */
function containerTag(userId: string): string {
  return `learnify-user-${userId}`;
}

export function createSupermemoryMemory(apiKey: string): LearnerMemory {
  let client: Supermemory | null = null;
  const getClient = (): Supermemory => {
    if (!client) client = new Supermemory({ apiKey });
    return client;
  };

  return {
    async remember(userId: string, insight: string): Promise<void> {
      const content = insight.trim();
      if (!content) return;
      await getClient().documents.add({
        content,
        containerTag: containerTag(userId),
      });
    },

    async recall(
      userId: string,
      query: string,
      k = 5,
    ): Promise<MemoryRecord[]> {
      const response = await getClient().search.memories({
        q: query,
        containerTag: containerTag(userId),
        limit: Math.max(1, k),
        rerank: true,
      });
      return response.results
        .map((r) => ({
          id: r.id,
          content: (r.memory ?? "").trim(),
          score: r.similarity,
        }))
        .filter((r) => r.content.length > 0);
    },

    async forget(userId: string): Promise<void> {
      // `containerTags` is deprecated in the SDK but remains the only way to
      // delete a whole container in one call; per-id deletion would need a
      // separate listing pass. Fine for the demo's account-reset path.
      await getClient().documents.deleteBulk({
        containerTags: [containerTag(userId)],
      });
    },
  };
}
