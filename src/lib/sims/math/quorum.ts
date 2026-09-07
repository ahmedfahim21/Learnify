/**
 * Quorum arithmetic for an N/W/R replicated store.
 *
 * The whole model rests on one inequality: when W + R > N the write set and
 * the read set must share at least one replica, so a read is guaranteed to
 * see the latest acknowledged write. Everything else — how many nodes you can
 * lose, how slow an operation is — falls out of where you put W and R.
 */

export interface QuorumInput {
  /** Replicas per key. */
  n: number;
  /** Replicas that must acknowledge a write. */
  w: number;
  /** Replicas consulted on a read. */
  r: number;
  /** Per-replica response time, in milliseconds. */
  replicaLatencyMs: number;
}

export interface QuorumOutput {
  /** W + R > N: every read overlaps every acknowledged write. */
  stronglyConsistent: boolean;
  /** Node failures a write can survive. */
  writeFailureTolerance: number;
  /** Node failures a read can survive. */
  readFailureTolerance: number;
  /** Both a read and a write remain possible after this many failures. */
  failureTolerance: number;
  /**
   * Latency is set by the slowest replica you must wait for. Waiting for k of
   * n roughly scales with k, since you need the k-th fastest response.
   */
  writeLatencyMs: number;
  readLatencyMs: number;
  /** True when the configuration is impossible (W or R exceeds N). */
  valid: boolean;
}

export function evaluateQuorum(input: QuorumInput): QuorumOutput {
  const { n, w, r, replicaLatencyMs } = input;
  const valid = w >= 1 && r >= 1 && w <= n && r <= n;

  return {
    valid,
    stronglyConsistent: valid && w + r > n,
    writeFailureTolerance: Math.max(0, n - w),
    readFailureTolerance: Math.max(0, n - r),
    failureTolerance: Math.max(0, Math.min(n - w, n - r)),
    writeLatencyMs: replicaLatencyMs * w,
    readLatencyMs: replicaLatencyMs * r,
  };
}

/** The common presets, so the trade-off can be compared rather than derived. */
export const QUORUM_PRESETS = [
  { label: "Fast, may read stale", w: 1, r: 1 },
  { label: "Balanced (W+R>N)", w: 2, r: 2 },
  { label: "Read-optimised", w: 3, r: 1 },
  { label: "Write-optimised", w: 1, r: 3 },
] as const;
