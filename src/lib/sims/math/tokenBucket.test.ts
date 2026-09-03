import { describe, expect, it } from "vitest";

import { simulateTokenBucket, type TokenBucketInput } from "./tokenBucket";

const base: TokenBucketInput = {
  capacity: 50,
  refillPerSec: 20,
  arrivalPerSec: 10,
  durationSec: 10,
};

describe("simulateTokenBucket", () => {
  it("accepts everything when arrival rate stays under the refill rate", () => {
    const out = simulateTokenBucket(base); // arrival 10 < refill 20
    expect(out.rejected).toBeCloseTo(0, 5);
    expect(out.acceptRate).toBeCloseTo(1, 5);
  });

  it("rejects the steady-state excess when arrival rate exceeds refill rate", () => {
    // Long enough run that the initial full bucket is a rounding error.
    const out = simulateTokenBucket({ ...base, arrivalPerSec: 30, refillPerSec: 20, durationSec: 200 });
    // Steady state: only refillPerSec/arrivalPerSec of arrivals can be admitted.
    expect(out.acceptRate).toBeCloseTo(20 / 30, 1);
  });

  it("lets capacity absorb a burst that a smaller bucket would reject", () => {
    const smallBucket = simulateTokenBucket({ ...base, capacity: 5, arrivalPerSec: 40, durationSec: 1 });
    const bigBucket = simulateTokenBucket({ ...base, capacity: 100, arrivalPerSec: 40, durationSec: 1 });
    expect(bigBucket.acceptRate).toBeGreaterThan(smallBucket.acceptRate);
  });

  it("never lets the token level exceed capacity", () => {
    const out = simulateTokenBucket({ ...base, arrivalPerSec: 0, durationSec: 20 });
    expect(Math.max(...out.samples.map((s) => s.tokens))).toBeLessThanOrEqual(base.capacity + 1e-9);
  });

  it("starts the bucket full", () => {
    const out = simulateTokenBucket(base);
    expect(out.samples[0].tokens).toBe(base.capacity);
  });

  it("produces roughly durationSec / stepSec samples", () => {
    const out = simulateTokenBucket({ ...base, durationSec: 10, stepSec: 0.5 });
    expect(out.samples.length).toBe(21); // t=0 plus 20 steps
  });
});
