import { describe, expect, it } from "vitest";

import { evaluateQuorum } from "./quorum";

const base = { n: 3, w: 2, r: 2, replicaLatencyMs: 10 };

describe("evaluateQuorum", () => {
  it("is strongly consistent exactly when W + R > N", () => {
    expect(evaluateQuorum(base).stronglyConsistent).toBe(true);
    expect(evaluateQuorum({ ...base, w: 1, r: 1 }).stronglyConsistent).toBe(false);
    // W + R == N is not enough: the sets can be disjoint.
    expect(evaluateQuorum({ ...base, w: 1, r: 2 }).stronglyConsistent).toBe(false);
  });

  it("trades failure tolerance against how many replicas must answer", () => {
    const balanced = evaluateQuorum(base);
    expect(balanced.writeFailureTolerance).toBe(1);
    expect(balanced.readFailureTolerance).toBe(1);

    const allReplicas = evaluateQuorum({ ...base, w: 3, r: 3 });
    // Consistent, but a single node down blocks everything.
    expect(allReplicas.stronglyConsistent).toBe(true);
    expect(allReplicas.failureTolerance).toBe(0);
  });

  it("makes reads cheap when writes are expensive, and vice versa", () => {
    const readOptimised = evaluateQuorum({ ...base, w: 3, r: 1 });
    expect(readOptimised.readLatencyMs).toBeLessThan(readOptimised.writeLatencyMs);

    const writeOptimised = evaluateQuorum({ ...base, w: 1, r: 3 });
    expect(writeOptimised.writeLatencyMs).toBeLessThan(writeOptimised.readLatencyMs);
  });

  it("rejects a configuration asking for more replicas than exist", () => {
    expect(evaluateQuorum({ ...base, w: 4 }).valid).toBe(false);
    expect(evaluateQuorum({ ...base, r: 0 }).valid).toBe(false);
    expect(evaluateQuorum({ ...base, w: 4 }).stronglyConsistent).toBe(false);
  });
});
