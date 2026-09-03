/**
 * The classic "latency numbers every programmer should know" — canonical
 * reference values plus a helper for the "how many fit in your budget?" slider.
 */

export interface LatencyReference {
  id: string;
  label: string;
  nanoseconds: number;
}

export const LATENCY_REFERENCES: LatencyReference[] = [
  { id: "l1", label: "L1 cache reference", nanoseconds: 1 },
  { id: "branch", label: "Branch mispredict", nanoseconds: 5 },
  { id: "l2", label: "L2 cache reference", nanoseconds: 7 },
  { id: "mutex", label: "Mutex lock/unlock", nanoseconds: 25 },
  { id: "mem", label: "Main memory reference", nanoseconds: 100 },
  { id: "zip1k", label: "Compress 1KB with Zippy", nanoseconds: 3_000 },
  { id: "net1gbps", label: "Send 1KB over 1Gbps network", nanoseconds: 10_000 },
  { id: "ssd-random", label: "Read 4KB randomly from SSD", nanoseconds: 150_000 },
  { id: "mem-round-trip", label: "Round trip within same datacenter", nanoseconds: 500_000 },
  { id: "disk-seek", label: "Disk seek", nanoseconds: 10_000_000 },
  { id: "read-1mb-net", label: "Read 1MB sequentially over network", nanoseconds: 10_000_000 },
  { id: "packet-ca-nl", label: "Packet round trip CA -> Netherlands -> CA", nanoseconds: 150_000_000 },
];

/** How many of a given reference fit inside a p99 budget, floored. */
export function fitCount(budgetMs: number, referenceNs: number): number {
  const budgetNs = Math.max(0, budgetMs) * 1_000_000;
  return referenceNs > 0 ? Math.floor(budgetNs / referenceNs) : 0;
}
