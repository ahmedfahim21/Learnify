import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { currentDay, DEFAULT_DAILY_LIMIT, dailyLimit } from "./budget";

const original = process.env.GENERATION_DAILY_LIMIT;

afterEach(() => {
  if (original === undefined) delete process.env.GENERATION_DAILY_LIMIT;
  else process.env.GENERATION_DAILY_LIMIT = original;
});

describe("dailyLimit", () => {
  beforeEach(() => {
    delete process.env.GENERATION_DAILY_LIMIT;
  });

  it("falls back to the default when unset", () => {
    expect(dailyLimit()).toBe(DEFAULT_DAILY_LIMIT);
  });

  it("reads a configured limit", () => {
    process.env.GENERATION_DAILY_LIMIT = "5";
    expect(dailyLimit()).toBe(5);
  });

  it("floors a fractional limit rather than allowing a partial generation", () => {
    process.env.GENERATION_DAILY_LIMIT = "7.9";
    expect(dailyLimit()).toBe(7);
  });

  it.each(["0", "-3", "not-a-number", ""])(
    "ignores a nonsensical limit (%s) instead of locking everyone out",
    (value) => {
      process.env.GENERATION_DAILY_LIMIT = value;
      expect(dailyLimit()).toBe(DEFAULT_DAILY_LIMIT);
    },
  );
});

describe("currentDay", () => {
  it("keys on the UTC calendar day", () => {
    expect(currentDay(new Date("2026-09-07T13:45:00Z"))).toBe("2026-09-07");
  });

  it("does not roll over with local timezone, only UTC", () => {
    // 23:30 UTC and 00:30 UTC the next day are different windows...
    expect(currentDay(new Date("2026-09-07T23:30:00Z"))).toBe("2026-09-07");
    expect(currentDay(new Date("2026-09-08T00:30:00Z"))).toBe("2026-09-08");
  });

  it("treats the whole UTC day as one window", () => {
    const start = currentDay(new Date("2026-09-07T00:00:00Z"));
    const end = currentDay(new Date("2026-09-07T23:59:59Z"));
    expect(start).toBe(end);
  });
});

/**
 * consumeGeneration's correctness lives in a single atomic upsert whose
 * conflict clause carries the limit, so two racing turns can't both spend the
 * last unit. These cover the two branches around that statement: the database
 * returning a row (spent) versus returning none (rejected at the limit).
 */
describe("consumeGeneration", () => {
  const returning = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    delete process.env.GENERATION_DAILY_LIMIT;
    returning.mockReset();
    vi.doMock("@/db", () => ({
      getDb: () => ({
        insert: () => ({
          values: () => ({ onConflictDoUpdate: () => ({ returning }) }),
        }),
      }),
    }));
  });

  it("reports the spend and what remains when the upsert succeeds", async () => {
    process.env.GENERATION_DAILY_LIMIT = "10";
    returning.mockResolvedValue([{ used: 3 }]);
    const { consumeGeneration } = await import("./budget");

    const result = await consumeGeneration("user-1");

    expect(result.allowed).toBe(true);
    expect(result.state).toEqual({ used: 3, limit: 10, remaining: 7, exceeded: false });
  });

  it("marks the budget exceeded on the turn that consumes the last unit", async () => {
    process.env.GENERATION_DAILY_LIMIT = "10";
    returning.mockResolvedValue([{ used: 10 }]);
    const { consumeGeneration } = await import("./budget");

    const result = await consumeGeneration("user-1");

    // Still allowed — this turn got the last unit; the next one won't.
    expect(result.allowed).toBe(true);
    expect(result.state).toEqual({ used: 10, limit: 10, remaining: 0, exceeded: true });
  });

  it("refuses when the conflict clause rejects the increment", async () => {
    process.env.GENERATION_DAILY_LIMIT = "10";
    returning.mockResolvedValue([]);
    const { consumeGeneration } = await import("./budget");

    const result = await consumeGeneration("user-1");

    expect(result.allowed).toBe(false);
    expect(result.state).toEqual({ used: 10, limit: 10, remaining: 0, exceeded: true });
  });
});
