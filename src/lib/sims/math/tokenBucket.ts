/**
 * Token-bucket rate limiter: deterministic time-stepped simulation over a
 * fixed-size window, given a constant arrival rate. Backs the `token-bucket`
 * simulator's "capacity buys burst tolerance, rate buys sustained throughput —
 * independent knobs" observation.
 */

export interface TokenBucketInput {
  /** Max tokens the bucket holds. */
  capacity: number;
  /** Tokens added per second. */
  refillPerSec: number;
  /** Constant arrival rate of requests/sec, each costing 1 token. */
  arrivalPerSec: number;
  /** Seconds of simulated time. */
  durationSec: number;
  /** Simulation step size in seconds (smaller = smoother, slower). */
  stepSec?: number;
}

export interface TokenBucketSample {
  t: number;
  tokens: number;
}

export interface TokenBucketOutput {
  samples: TokenBucketSample[];
  accepted: number;
  rejected: number;
  acceptRate: number;
}

export function simulateTokenBucket(input: TokenBucketInput): TokenBucketOutput {
  const step = input.stepSec ?? 0.1;
  const capacity = Math.max(0, input.capacity);
  const steps = Math.max(1, Math.round(input.durationSec / step));

  let tokens = capacity;
  let accepted = 0;
  let rejected = 0;
  const samples: TokenBucketSample[] = [{ t: 0, tokens }];

  // Fractional-request accounting: at each step, refill continuously, then
  // decide how many of this step's arrivals the remaining tokens can admit.
  for (let i = 1; i <= steps; i++) {
    tokens = Math.min(capacity, tokens + input.refillPerSec * step);
    const arrivalsThisStep = input.arrivalPerSec * step;
    const admits = Math.min(arrivalsThisStep, tokens);
    accepted += admits;
    rejected += arrivalsThisStep - admits;
    tokens -= admits;
    samples.push({ t: i * step, tokens });
  }

  const total = accepted + rejected;
  return {
    samples,
    accepted,
    rejected,
    acceptRate: total > 0 ? accepted / total : 1,
  };
}
