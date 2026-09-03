import { describe, expect, it } from "vitest";

import { fitCount, LATENCY_REFERENCES } from "./latencyScale";

describe("LATENCY_REFERENCES", () => {
  it("is ordered from fastest to slowest", () => {
    for (let i = 1; i < LATENCY_REFERENCES.length; i++) {
      expect(LATENCY_REFERENCES[i].nanoseconds).toBeGreaterThanOrEqual(
        LATENCY_REFERENCES[i - 1].nanoseconds,
      );
    }
  });

  it("has a unique id per reference", () => {
    const ids = LATENCY_REFERENCES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("fitCount", () => {
  it("shows a cross-region round trip costs ~150,000x an L1 reference", () => {
    const l1 = LATENCY_REFERENCES.find((r) => r.id === "l1")!;
    const crossRegion = LATENCY_REFERENCES.find((r) => r.id === "packet-ca-nl")!;
    expect(crossRegion.nanoseconds / l1.nanoseconds).toBeCloseTo(150_000_000, -6);
  });

  it("floors a partial fit", () => {
    expect(fitCount(0.0015, 1)).toBe(1_500); // 1.5us budget (1500ns) / 1ns each
  });

  it("returns 0 for a zero budget", () => {
    expect(fitCount(0, 100)).toBe(0);
  });
});
