/**
 * Per-server load distribution under a load-balancing algorithm. Deterministic
 * given a seeded pseudo-random skew, so the sim is reproducible across
 * renders with the same params — backs the `load-balancer` simulator.
 */

export type LoadBalancerAlgorithm = "round-robin" | "least-connections" | "random" | "hash";

export interface LoadBalancerInput {
  serverCount: number;
  requestCount: number;
  algorithm: LoadBalancerAlgorithm;
  /** 0 = uniform request cost, 1 = highly skewed (a few requests dominate). */
  skew: number;
}

export interface LoadBalancerOutput {
  /** Requests routed to each server, index = server id. */
  perServerLoad: number[];
  meanLoad: number;
  maxLoad: number;
  /** max / mean — 1.0 is perfectly even. */
  imbalanceRatio: number;
}

/** Mulberry32 — a small deterministic PRNG so results are stable per input. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function simulateLoadBalancer(input: LoadBalancerInput): LoadBalancerOutput {
  const serverCount = Math.max(1, Math.round(input.serverCount));
  const requestCount = Math.max(0, Math.round(input.requestCount));
  const skew = Math.min(1, Math.max(0, input.skew));
  const perServerLoad = new Array(serverCount).fill(0);
  const rand = mulberry32(1337);

  // Request "cost" grows with skew, simulating some requests being far more
  // expensive than others (e.g. a hot key). Even algorithms route by *count*,
  // not cost, so skew is what exposes their weaknesses.
  const costOf = (i: number) => 1 + skew * 9 * Math.pow(rand(), 3) * (i % 7 === 0 ? 1 : 0.15);

  if (input.algorithm === "round-robin") {
    for (let i = 0; i < requestCount; i++) {
      perServerLoad[i % serverCount] += costOf(i);
    }
  } else if (input.algorithm === "random") {
    for (let i = 0; i < requestCount; i++) {
      perServerLoad[Math.floor(rand() * serverCount)] += costOf(i);
    }
  } else if (input.algorithm === "hash") {
    // A stand-in request key, hashed to a server — models the classic
    // "modulo hashing" imbalance without a real key distribution.
    for (let i = 0; i < requestCount; i++) {
      const key = Math.floor(rand() * 1_000_000);
      perServerLoad[key % serverCount] += costOf(i);
    }
  } else {
    // least-connections: always route to the currently-lightest server.
    for (let i = 0; i < requestCount; i++) {
      let min = 0;
      for (let s = 1; s < serverCount; s++) {
        if (perServerLoad[s] < perServerLoad[min]) min = s;
      }
      perServerLoad[min] += costOf(i);
    }
  }

  const total = perServerLoad.reduce((a, b) => a + b, 0);
  const meanLoad = total / serverCount;
  const maxLoad = Math.max(...perServerLoad, 0);

  return {
    perServerLoad,
    meanLoad,
    maxLoad,
    imbalanceRatio: meanLoad > 0 ? maxLoad / meanLoad : 1,
  };
}
