/**
 * Closed vocabulary of hand-built simulators. Lives outside catalog.ts (not
 * inside it) so the catalog and the simulator registry share one source
 * without an import cycle — catalog.ts imports SIMULATOR_IDS, and
 * registry.ts imports catalog types.
 */
export const SIMULATOR_IDS = [
  "cache-hit-ratio",
  "load-balancer",
  "token-bucket",
  "consistent-hashing",
  "queue-backpressure",
  "latency-numbers",
  "back-of-envelope",
  "replication-lag",
  "quorum-tradeoff",
  "cdn-geo",
] as const;

export type SimulatorId = (typeof SIMULATOR_IDS)[number];
