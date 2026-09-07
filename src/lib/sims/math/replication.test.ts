import { describe, expect, it } from "vitest";

import { simulateReplication } from "./replication";

const base = { writeRate: 100, applyRate: 200, networkMs: 5, sustainedSec: 60, replicaCount: 2 };

describe("simulateReplication", () => {
  it("keeps lag at the network hop while under capacity", () => {
    const out = simulateReplication(base);
    expect(out.saturated).toBe(false);
    expect(out.backlog).toBe(0);
    expect(out.lagMs).toBe(5);
  });

  it("grows a backlog once writes outpace what a replica can apply", () => {
    const out = simulateReplication({ ...base, writeRate: 300 });
    expect(out.saturated).toBe(true);
    // 100 excess writes/sec for 60s.
    expect(out.backlog).toBe(6000);
    expect(out.lagMs).toBeGreaterThan(base.networkMs);
  });

  it("compounds lag the longer an overload is sustained", () => {
    const short = simulateReplication({ ...base, writeRate: 300, sustainedSec: 10 });
    const long = simulateReplication({ ...base, writeRate: 300, sustainedSec: 120 });
    expect(long.lagMs).toBeGreaterThan(short.lagMs);
  });

  it("reports utilisation crossing 1 exactly at capacity", () => {
    expect(simulateReplication({ ...base, writeRate: 200 }).utilization).toBe(1);
    expect(simulateReplication({ ...base, writeRate: 200 }).saturated).toBe(false);
    expect(simulateReplication({ ...base, writeRate: 201 }).saturated).toBe(true);
  });

  it("raises the chance of a stale read as lag grows", () => {
    const calm = simulateReplication(base);
    const behind = simulateReplication({ ...base, writeRate: 400 });
    expect(behind.staleReadChance).toBeGreaterThan(calm.staleReadChance);
    expect(behind.staleReadChance).toBeLessThanOrEqual(1);
  });

  it("scales read capacity with replica count, not write capacity", () => {
    expect(simulateReplication({ ...base, replicaCount: 0 }).readCapacityMultiple).toBe(1);
    expect(simulateReplication({ ...base, replicaCount: 5 }).readCapacityMultiple).toBe(6);
  });
});
