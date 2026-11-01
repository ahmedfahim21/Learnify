import { describe, expect, it } from "vitest";

import { asOf, dayKey, nextStreak } from "@/lib/streaks";

import { cardId, identifyCards } from "./review";

const en = [
  { front: "What is ENIAC?", back: "The first digital computer", startSec: 55 },
  { front: "What is a register?", back: "Fast storage in the CPU", startSec: 300 },
];
const ta = [
  { front: "ENIAC என்றால் என்ன?", back: "முதல் digital computer", startSec: 55 },
  { front: "Register என்றால் என்ன?", back: "CPU-ல fast storage", startSec: 300 },
];

describe("card ids", () => {
  it("are stable, short and differ per card and lecture", () => {
    const a = cardId("lec-1", en[0]);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(cardId("lec-1", en[0])).toBe(a);
    expect(cardId("lec-1", en[1])).not.toBe(a);
    expect(cardId("lec-2", en[0])).not.toBe(a);
  });

  it("are the same in every language, taken from the English card", () => {
    const enIds = identifyCards("lec-1", en, en).map((c) => c.id);
    const taCards = identifyCards("lec-1", ta, en);
    expect(taCards.map((c) => c.id)).toEqual(enIds);
    expect(taCards[0]).toEqual({ ...ta[0], id: enIds[0] });
  });
});

describe("nextStreak", () => {
  it("starts at 1", () => {
    expect(nextStreak(null, "2026-11-01")).toEqual({ current: 1, longest: 1, lastActiveDate: "2026-11-01" });
  });

  it("is unchanged on the same day", () => {
    const s = { current: 4, longest: 9, lastActiveDate: "2026-11-01" };
    expect(nextStreak(s, "2026-11-01")).toBe(s);
  });

  it("grows on the next day, and raises the longest", () => {
    expect(nextStreak({ current: 9, longest: 9, lastActiveDate: "2026-10-31" }, "2026-11-01")).toEqual({
      current: 10,
      longest: 10,
      lastActiveDate: "2026-11-01",
    });
  });

  it("resets to 1 after a gap, keeping the longest", () => {
    expect(nextStreak({ current: 5, longest: 12, lastActiveDate: "2026-10-28" }, "2026-11-01")).toEqual({
      current: 1,
      longest: 12,
      lastActiveDate: "2026-11-01",
    });
  });
});

describe("dayKey", () => {
  it("rolls over at midnight IST, not UTC", () => {
    expect(dayKey(new Date("2026-10-31T18:29:00Z"))).toBe("2026-10-31");
    expect(dayKey(new Date("2026-10-31T18:31:00Z"))).toBe("2026-11-01");
  });
});

describe("asOf", () => {
  const now = new Date("2026-11-01T06:00:00Z");
  it("keeps a streak active today or yesterday, and lapses an older one to 0", () => {
    expect(asOf({ current: 4, longest: 9, lastActiveDate: "2026-11-01" }, now).current).toBe(4);
    expect(asOf({ current: 4, longest: 9, lastActiveDate: "2026-10-31" }, now).current).toBe(4);
    expect(asOf({ current: 4, longest: 9, lastActiveDate: "2026-10-30" }, now)).toEqual({ current: 0, longest: 9, lastActiveDate: "2026-10-30" });
    expect(asOf(null, now)).toEqual({ current: 0, longest: 0, lastActiveDate: null });
  });
});
