import { describe, expect, it } from "vitest";

import { pointsFor, starsFor } from "./screenLibrary";

describe("quiz scoring", () => {
  it("gives 10 points a right answer and a 5-point bonus from a streak of three", () => {
    expect([1, 2, 3, 4, 10].map(pointsFor)).toEqual([10, 10, 15, 15, 15]);
  });

  it("awards stars at 30%, 60% and 90% right", () => {
    expect(starsFor(0, 10)).toBe(0);
    expect(starsFor(2, 10)).toBe(0);
    expect(starsFor(3, 10)).toBe(1);
    expect(starsFor(6, 10)).toBe(2);
    expect(starsFor(8, 10)).toBe(2);
    expect(starsFor(9, 10)).toBe(3);
    expect(starsFor(10, 10)).toBe(3);
  });

  it("gives an empty quiz no stars rather than dividing by zero", () => {
    expect(starsFor(0, 0)).toBe(0);
  });
});
