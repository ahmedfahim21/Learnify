/**
 * Effective latency / origin load / cost under a cache with a given hit ratio.
 * Pure closed-form arithmetic — no time-stepping. Backs the `cache-hit-ratio`
 * simulator's "80% -> 90% halves origin load; 99% -> 99.9% barely moves
 * latency" observation.
 */

export interface CacheHitRatioInput {
  /** 0..1 */
  hitRatio: number;
  /** ms */
  cacheLatencyMs: number;
  /** ms */
  originLatencyMs: number;
  /** requests/sec */
  qps: number;
  /** $ per GB-month for the cache */
  cacheCostPerGbMonth: number;
  /** GB of cache provisioned */
  cacheSizeGb: number;
  /** $ per million origin requests */
  originCostPerMillion: number;
}

export interface CacheHitRatioOutput {
  effectiveLatencyMs: number;
  originQps: number;
  cacheQps: number;
  monthlyCacheCost: number;
  monthlyOriginCost: number;
  monthlyTotalCost: number;
}

const SECONDS_PER_MONTH = 60 * 60 * 24 * 30;

export function simulateCacheHitRatio(input: CacheHitRatioInput): CacheHitRatioOutput {
  const h = Math.min(1, Math.max(0, input.hitRatio));
  const effectiveLatencyMs = h * input.cacheLatencyMs + (1 - h) * input.originLatencyMs;
  const originQps = (1 - h) * input.qps;
  const cacheQps = h * input.qps;

  const monthlyOriginRequests = (originQps * SECONDS_PER_MONTH) / 1_000_000;
  const monthlyOriginCost = monthlyOriginRequests * input.originCostPerMillion;
  const monthlyCacheCost = input.cacheSizeGb * input.cacheCostPerGbMonth;

  return {
    effectiveLatencyMs,
    originQps,
    cacheQps,
    monthlyCacheCost,
    monthlyOriginCost,
    monthlyTotalCost: monthlyCacheCost + monthlyOriginCost,
  };
}
