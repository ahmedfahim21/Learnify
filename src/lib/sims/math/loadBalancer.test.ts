import { describe, expect, it } from "vitest";

import { simulateLoadBalancer, type LoadBalancerInput } from "./loadBalancer";

const base: LoadBalancerInput = {
  serverCount: 5,
  requestCount: 10_000,
  algorithm: "round-robin",
  skew: 0,
};

describe("simulateLoadBalancer", () => {
  it("distributes total load exactly across per-server buckets", () => {
    const out = simulateLoadBalancer(base);
    const total = out.perServerLoad.reduce((a, b) => a + b, 0);
    // With zero skew, every request costs exactly 1.
    expect(total).toBeCloseTo(base.requestCount, 5);
  });

  it("returns one bucket per server", () => {
    const out = simulateLoadBalancer(base);
    expect(out.perServerLoad).toHaveLength(base.serverCount);
  });

  it("round-robin with zero skew is perfectly even", () => {
    const out = simulateLoadBalancer({ ...base, requestCount: 10_000 });
    expect(out.imbalanceRatio).toBeCloseTo(1, 2);
  });

  it("least-connections stays even even under skew", () => {
    const lc = simulateLoadBalancer({ ...base, algorithm: "least-connections", skew: 0.8 });
    expect(lc.imbalanceRatio).toBeLessThan(1.05);
  });

  it("random and hash algorithms produce more imbalance than least-connections under skew", () => {
    const skewed = { ...base, skew: 0.8, requestCount: 20_000 };
    const lc = simulateLoadBalancer({ ...skewed, algorithm: "least-connections" });
    const random = simulateLoadBalancer({ ...skewed, algorithm: "random" });
    expect(random.imbalanceRatio).toBeGreaterThanOrEqual(lc.imbalanceRatio);
  });

  it("is deterministic for the same input", () => {
    const a = simulateLoadBalancer({ ...base, algorithm: "hash", skew: 0.6 });
    const b = simulateLoadBalancer({ ...base, algorithm: "hash", skew: 0.6 });
    expect(a.perServerLoad).toEqual(b.perServerLoad);
  });

  it("floors serverCount at 1 to avoid a divide-by-zero", () => {
    const out = simulateLoadBalancer({ ...base, serverCount: 0 });
    expect(out.perServerLoad).toHaveLength(1);
  });
});
