import { describe, expect, it } from "vitest";

import { simulateQueueing } from "./queueing";

describe("simulateQueueing — M/M/1", () => {
  it("computes utilisation as arrival/service rate for a single worker", () => {
    const out = simulateQueueing({ arrivalRate: 50, serviceRate: 100, workers: 1 });
    expect(out.utilization).toBeCloseTo(0.5, 5);
  });

  it("satisfies Little's law: L = lambda * W", () => {
    const arrivalRate = 60;
    const out = simulateQueueing({ arrivalRate, serviceRate: 100, workers: 1 });
    expect(out.meanNumberInSystem).toBeCloseTo(arrivalRate * out.meanWaitSec, 5);
  });

  it("diverges as utilisation approaches 1", () => {
    const mid = simulateQueueing({ arrivalRate: 50, serviceRate: 100, workers: 1 }); // rho 0.5
    const high = simulateQueueing({ arrivalRate: 90, serviceRate: 100, workers: 1 }); // rho 0.9
    expect(high.meanWaitSec).toBeGreaterThan(mid.meanWaitSec * 5); // roughly 10x per the doc comment
  });

  it("flags an overloaded system as unstable", () => {
    const out = simulateQueueing({ arrivalRate: 150, serviceRate: 100, workers: 1 });
    expect(out.unstable).toBe(true);
  });

  it("does not flag a comfortably loaded system as unstable", () => {
    const out = simulateQueueing({ arrivalRate: 50, serviceRate: 100, workers: 1 });
    expect(out.unstable).toBe(false);
  });
});

describe("simulateQueueing — M/M/c (Erlang C)", () => {
  it("adding workers at fixed total load reduces wait time", () => {
    const oneWorker = simulateQueueing({ arrivalRate: 180, serviceRate: 100, workers: 2 });
    const fourWorkers = simulateQueueing({ arrivalRate: 180, serviceRate: 100, workers: 4 });
    expect(fourWorkers.meanWaitSec).toBeLessThan(oneWorker.meanWaitSec);
  });

  it("still satisfies Little's law with multiple workers", () => {
    const arrivalRate = 250;
    const out = simulateQueueing({ arrivalRate, serviceRate: 100, workers: 3 });
    expect(out.meanNumberInSystem).toBeCloseTo(arrivalRate * out.meanWaitSec, 5);
  });
});
