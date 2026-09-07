import { describe, expect, it } from "vitest";

import { simulateCdn } from "./cdnGeo";

const base = {
  edgeHitRatio: 0.9,
  edgeKm: 50,
  originKm: 9000,
  serverMs: 10,
  requestsPerSec: 10_000,
  bytesPerResponse: 500_000,
};

describe("simulateCdn", () => {
  it("charges a round trip, not a one-way hop", () => {
    // 9000km at 200km/ms is 45ms each way, plus 10ms of server time.
    expect(simulateCdn(base).originRoundTripMs).toBeCloseTo(100, 5);
  });

  it("makes distance, not caching, the dominant term", () => {
    const near = simulateCdn({ ...base, edgeHitRatio: 1, edgeKm: 50 });
    const far = simulateCdn({ ...base, edgeHitRatio: 1, edgeKm: 9000 });
    expect(far.effectiveMs).toBeGreaterThan(near.effectiveMs * 5);
  });

  it("blends hit and miss latency by the hit ratio", () => {
    const out = simulateCdn(base);
    const expected = 0.9 * out.edgeRoundTripMs + 0.1 * out.originRoundTripMs;
    expect(out.effectiveMs).toBeCloseTo(expected, 6);
  });

  it("removes origin egress in proportion to the hit ratio", () => {
    const out = simulateCdn(base);
    expect(out.originRequestsPerSec).toBeCloseTo(1000, 6);
    expect(out.originBytesPerSec).toBeCloseTo(1000 * base.bytesPerResponse, 3);
    expect(out.egressSaved).toBeCloseTo(0.9, 6);
  });

  it("falls back to pure origin cost at a zero hit ratio", () => {
    const out = simulateCdn({ ...base, edgeHitRatio: 0 });
    expect(out.effectiveMs).toBeCloseTo(out.originRoundTripMs, 6);
    expect(out.originRequestsPerSec).toBe(base.requestsPerSec);
  });

  it("clamps a nonsensical hit ratio rather than inverting the maths", () => {
    expect(simulateCdn({ ...base, edgeHitRatio: 1.5 }).originRequestsPerSec).toBe(0);
    expect(simulateCdn({ ...base, edgeHitRatio: -1 }).originRequestsPerSec).toBe(base.requestsPerSec);
  });
});
