/**
 * Primary/replica replication under write load.
 *
 * Replication lag is not a fixed property of a system — it is what happens
 * when the rate of writes arriving at the primary exceeds the rate a replica
 * can apply them. Below capacity the lag settles at the network round trip;
 * above it, the backlog grows for as long as the overload lasts.
 *
 * Pure and dependency-free so it can be unit-tested directly.
 */

export interface ReplicationInput {
  /** Writes/sec arriving at the primary. */
  writeRate: number;
  /** Writes/sec a single replica can apply. */
  applyRate: number;
  /** One-way network delay to the replica, in milliseconds. */
  networkMs: number;
  /** How long the current write rate has been sustained, in seconds. */
  sustainedSec: number;
  /** Replicas serving reads. */
  replicaCount: number;
}

export interface ReplicationOutput {
  /** True when writes arrive faster than a replica can apply them. */
  saturated: boolean;
  /** Replica utilisation, 1.0 = exactly at capacity. */
  utilization: number;
  /** Writes queued on the replica, waiting to be applied. */
  backlog: number;
  /** How far behind the replica is, in milliseconds. */
  lagMs: number;
  /** Chance a read hits a replica that hasn't applied your own write yet. */
  staleReadChance: number;
  /** Aggregate read capacity, relative to a single node. */
  readCapacityMultiple: number;
}

export function simulateReplication(input: ReplicationInput): ReplicationOutput {
  const { writeRate, applyRate, networkMs, sustainedSec, replicaCount } = input;

  const utilization = applyRate <= 0 ? Infinity : writeRate / applyRate;
  const saturated = writeRate > applyRate;

  // Under capacity the replica keeps up and lag is just the network hop.
  // Over capacity the backlog grows linearly for as long as it is sustained.
  const backlog = saturated ? (writeRate - applyRate) * sustainedSec : 0;
  const drainMs = saturated && applyRate > 0 ? (backlog / applyRate) * 1000 : 0;
  const lagMs = networkMs + drainMs;

  // A read is stale if it lands on a replica during the window your write has
  // not yet reached. Longer lag and more replicas both widen that window.
  const staleReadChance =
    replicaCount <= 0 ? 0 : Math.min(1, (lagMs / 1000) * (replicaCount / (replicaCount + 1)));

  return {
    saturated,
    utilization,
    backlog,
    lagMs,
    staleReadChance,
    readCapacityMultiple: 1 + replicaCount,
  };
}
