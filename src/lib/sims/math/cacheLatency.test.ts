import { describe, expect, it } from "vitest";

import { simulateCacheHitRatio, type CacheHitRatioInput } from "./cacheLatency";

const base: CacheHitRatioInput = {
  hitRatio: 0.8,
  cacheLatencyMs: 1,
  originLatencyMs: 81,
  qps: 1000,
  cacheCostPerGbMonth: 3,
  cacheSizeGb: 50,
  originCostPerMillion: 5,
};

describe("simulateCacheHitRatio", () => {
  it("computes effective latency as the hit-weighted blend", () => {
    const out = simulateCacheHitRatio(base);
    expect(out.effectiveLatencyMs).toBeCloseTo(0.8 * 1 + 0.2 * 81, 5);
  });

  it("sends 100% hit ratio to the cache latency alone", () => {
    const out = simulateCacheHitRatio({ ...base, hitRatio: 1 });
    expect(out.effectiveLatencyMs).toBeCloseTo(base.cacheLatencyMs, 5);
    expect(out.originQps).toBe(0);
  });

  it("sends 0% hit ratio to the origin latency alone", () => {
    const out = simulateCacheHitRatio({ ...base, hitRatio: 0 });
    expect(out.effectiveLatencyMs).toBeCloseTo(base.originLatencyMs, 5);
    expect(out.originQps).toBe(base.qps);
  });

  it("is monotonically non-increasing in latency as hit ratio rises (cache is faster)", () => {
    const low = simulateCacheHitRatio({ ...base, hitRatio: 0.5 });
    const high = simulateCacheHitRatio({ ...base, hitRatio: 0.95 });
    expect(high.effectiveLatencyMs).toBeLessThan(low.effectiveLatencyMs);
  });

  it("halves origin QPS going from 80% to 90% hit ratio", () => {
    const at80 = simulateCacheHitRatio({ ...base, hitRatio: 0.8 });
    const at90 = simulateCacheHitRatio({ ...base, hitRatio: 0.9 });
    expect(at90.originQps).toBeCloseTo(at80.originQps / 2, 5);
  });

  it("clamps an out-of-range hit ratio into [0, 1]", () => {
    const over = simulateCacheHitRatio({ ...base, hitRatio: 1.5 });
    const under = simulateCacheHitRatio({ ...base, hitRatio: -0.5 });
    expect(over.effectiveLatencyMs).toBeCloseTo(base.cacheLatencyMs, 5);
    expect(under.effectiveLatencyMs).toBeCloseTo(base.originLatencyMs, 5);
  });

  it("sums cache and origin cost into the total", () => {
    const out = simulateCacheHitRatio(base);
    expect(out.monthlyTotalCost).toBeCloseTo(out.monthlyCacheCost + out.monthlyOriginCost, 5);
  });
});
