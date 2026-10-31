import { describe, expect, it } from "vitest";

import { createLimiter } from "./limiter";

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("createLimiter", () => {
  it("runs at most max tasks at once, then the queue in order", async () => {
    const limiter = createLimiter(2);
    const gates = [deferred(), deferred(), deferred()];
    const started: number[] = [];
    const runs = gates.map((g, n) =>
      limiter.run(async () => {
        started.push(n);
        await g.promise;
        return n;
      }),
    );

    await tick();
    expect(started).toEqual([0, 1]);
    expect(limiter.active).toBe(2);
    expect(limiter.waiting).toBe(1);

    gates[0].resolve();
    await tick();
    expect(started).toEqual([0, 1, 2]);

    gates[1].resolve();
    gates[2].resolve();
    expect(await Promise.all(runs)).toEqual([0, 1, 2]);
    expect(limiter.active).toBe(0);
  });

  it("frees the slot when a task throws", async () => {
    const limiter = createLimiter(1);
    await expect(limiter.run(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(limiter.active).toBe(0);
    await expect(limiter.run(async () => "next")).resolves.toBe("next");
  });

  it.each([0, -1, 1.5])("refuses a size of %s", (n) => {
    expect(() => createLimiter(n)).toThrow(/positive integer/);
  });
});
