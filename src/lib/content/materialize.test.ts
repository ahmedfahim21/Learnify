import { beforeEach, describe, expect, it, vi } from "vitest";

import { chainEdges, flattenConcepts } from "@/content/systemDesign/types";
import { urlShortener } from "@/content/systemDesign/problems/urlShortener";
import { conceptEdges, concepts, topics } from "@/db/schema";

/**
 * A minimal in-memory double for the slice of the Drizzle query builder
 * `materializeProblem` actually calls: select/where/limit, and
 * insert/values/onConflictDoNothing/returning. It's not a Drizzle
 * reimplementation — just enough chained state to exercise the real control
 * flow (idempotency, insert shapes, slug->id edge resolution) without a
 * live Postgres connection.
 */
function createFakeDb() {
  const topicsRows: { id: string; userId: string; problemSlug: string | null }[] = [];
  const conceptsRows: { id: string; topicId: string; slug: string; orderIndex: number; phase: string | null }[] = [];
  const edgeRows: { topicId: string; fromConceptId: string; toConceptId: string }[] = [];
  let nextId = 1;
  const newId = () => `id-${nextId++}`;

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => {
            // The two select calls in materialize.ts are both against
            // `topics`, filtered by (userId, problemSlug) via `and(eq, eq)`.
            // This fake re-derives the same filter from the last insert call
            // recorded, which is sufficient for this test's single-user,
            // single-slug scenarios.
            void table;
            return db.__lastTopicFilter
              ? topicsRows.filter(
                  (t) =>
                    t.userId === db.__lastTopicFilter!.userId &&
                    t.problemSlug === db.__lastTopicFilter!.problemSlug,
                )
              : [];
          },
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: (rows: unknown) => {
        const asArray = Array.isArray(rows) ? rows : [rows];
        // Applies the insert to the fake's in-memory tables. Called from both
        // the `.returning()` path (concepts) and the bare-awaited
        // `.onConflictDoNothing()` path (topics, concept_edges) — real code
        // uses both shapes, so the fake has to support both.
        const apply = (): { id: string; slug: string }[] => {
          if (table === topics) {
            const row = asArray[0] as { userId: string; problemSlug: string };
            db.__lastTopicFilter = { userId: row.userId, problemSlug: row.problemSlug };
            const exists = topicsRows.some(
              (t) => t.userId === row.userId && t.problemSlug === row.problemSlug,
            );
            if (!exists) topicsRows.push({ id: newId(), ...row });
            return [];
          }
          if (table === concepts) {
            return (asArray as { topicId: string; slug: string }[]).map((row) => {
              const id = newId();
              conceptsRows.push({ id, ...row } as never);
              return { id, slug: row.slug };
            });
          }
          if (table === conceptEdges) {
            edgeRows.push(...(asArray as typeof edgeRows));
          }
          return [];
        };
        return {
          onConflictDoNothing: () => ({
            returning: async () => apply(),
            then: (resolve: (v: unknown) => void) => resolve(apply()),
          }),
        };
      },
    }),
    __lastTopicFilter: undefined as { userId: string; problemSlug: string } | undefined,
    __rows: { topicsRows, conceptsRows, edgeRows },
  };
  return db;
}

vi.mock("@/db", () => ({ getDb: () => fakeDb }));

const { materializeProblem } = await import("./materialize");

let fakeDb: ReturnType<typeof createFakeDb>;

beforeEach(() => {
  fakeDb = createFakeDb();
});

describe("materializeProblem", () => {
  it("inserts one concept row per authored concept, with orderIndex matching reading order", async () => {
    const { created } = await materializeProblem("user-1", "url-shortener");
    expect(created).toBe(true);

    const expectedSlugs = flattenConcepts(urlShortener).map((c) => c.slug);
    expect(fakeDb.__rows.conceptsRows.map((c) => c.slug)).toEqual(expectedSlugs);
    expect(fakeDb.__rows.conceptsRows.map((c) => c.orderIndex)).toEqual(
      expectedSlugs.map((_, i) => i),
    );
  });

  it("stamps each concept with its chapter's phase", async () => {
    await materializeProblem("user-1", "url-shortener");

    const expected = flattenConcepts(urlShortener);
    for (const row of fakeDb.__rows.conceptsRows) {
      const authored = expected.find((c) => c.slug === row.slug)!;
      expect(row.phase).toBe(authored.phase);
    }
  });

  it("resolves chain edges from concept slugs to their inserted ids", async () => {
    await materializeProblem("user-1", "url-shortener");

    const idBySlug = new Map(fakeDb.__rows.conceptsRows.map((c) => [c.slug, c.id]));
    const expectedEdges = chainEdges(urlShortener);
    expect(fakeDb.__rows.edgeRows).toHaveLength(expectedEdges.length);
    for (const edge of expectedEdges) {
      expect(
        fakeDb.__rows.edgeRows.some(
          (e) => e.fromConceptId === idBySlug.get(edge.from) && e.toConceptId === idBySlug.get(edge.to),
        ),
      ).toBe(true);
    }
  });

  it("is idempotent: a second call for the same user+slug inserts no new rows", async () => {
    const first = await materializeProblem("user-1", "url-shortener");
    const conceptCountAfterFirst = fakeDb.__rows.conceptsRows.length;
    const edgeCountAfterFirst = fakeDb.__rows.edgeRows.length;

    const second = await materializeProblem("user-1", "url-shortener");

    expect(second.topicId).toBe(first.topicId);
    expect(second.created).toBe(false);
    expect(fakeDb.__rows.conceptsRows.length).toBe(conceptCountAfterFirst);
    expect(fakeDb.__rows.edgeRows.length).toBe(edgeCountAfterFirst);
  });

  it("throws for an unknown course slug before touching the database", async () => {
    await expect(materializeProblem("user-1", "does-not-exist")).rejects.toThrow(
      /Unknown course slug/,
    );
    expect(fakeDb.__rows.topicsRows).toHaveLength(0);
  });
});
