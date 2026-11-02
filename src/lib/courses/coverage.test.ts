import { describe, expect, it } from "vitest";

import type { NptelLesson } from "@/lib/nptel/decode";

import { coverageTier } from "./coverage";
import { captionShareOf, decodeCursor, encodeCursor } from "./repo";

describe("coverageTier", () => {
  it.each([
    [1, 0],
    [0.9, 0],
    [0.89, 1],
    [0.5, 1],
    [0.49, 2],
    [0, 2],
    [null, 1],
  ] as const)("share %s → tier %s", (share, tier) => {
    expect(coverageTier(share)).toBe(tier);
  });
});

describe("captionShareOf", () => {
  const lesson = (youtubeId: string | null, english: boolean) => ({ youtubeId, vttIds: english ? { English: "x" } : { Tamil: "y" } }) as unknown as NptelLesson;

  it("counts lessons with both a video and English captions", () => {
    expect(captionShareOf([lesson("a", true), lesson("b", false), lesson(null, true), lesson("c", true)])).toBe(0.5);
  });

  it("is 0 for a course with no lessons", () => {
    expect(captionShareOf([])).toBe(0);
  });
});

describe("page cursor", () => {
  it("round-trips tier and id", () => {
    expect(encodeCursor({ tier: 2, id: 106106127 })).toBe("2.106106127");
    expect(decodeCursor("2.106106127")).toEqual({ tier: 2, id: 106106127 });
  });

  it.each(["5", "3.5", "1.", ".5", "1.5.6", "1.-5", "a.b"])("rejects %s", (raw) => {
    expect(decodeCursor(raw)).toBeNull();
  });
});
