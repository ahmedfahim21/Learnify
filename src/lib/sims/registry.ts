import type { SimulatorId } from "./ids";
import type { SimulatorSpec } from "./types";

/**
 * Metadata + param specs for every simulator, keyed by id. No React import —
 * this is imported from both the renderer (`components/classroom/simulators`)
 * and from Node-side tests / content validation.
 */
export const SIMULATOR_REGISTRY: Record<SimulatorId, SimulatorSpec> = {
  "cache-hit-ratio": {
    id: "cache-hit-ratio",
    title: "Cache hit ratio",
    summary:
      "See how the fraction of requests served from cache changes effective latency, origin load, and cost.",
    params: [
      { key: "hitRatio", label: "Hit ratio", kind: "percent", min: 0, max: 0.999, step: 0.01, default: 0.8 },
      { key: "cacheLatencyMs", label: "Cache latency", kind: "number", min: 0.1, max: 20, step: 0.1, unit: "ms", default: 1 },
      { key: "originLatencyMs", label: "Origin latency", kind: "number", min: 1, max: 500, step: 1, unit: "ms", default: 80 },
      { key: "qps", label: "Traffic", kind: "log", min: 10, max: 100_000, step: 10, unit: "req/s", default: 5_000 },
      { key: "cacheSizeGb", label: "Cache size", kind: "number", min: 1, max: 1_000, step: 1, unit: "GB", default: 50 },
      { key: "cacheCostPerGbMonth", label: "Cache cost", kind: "number", min: 0, max: 50, step: 0.5, unit: "$/GB-mo", default: 3 },
      { key: "originCostPerMillion", label: "Origin cost", kind: "number", min: 0, max: 50, step: 0.5, unit: "$/M req", default: 5 },
    ],
  },

  "load-balancer": {
    id: "load-balancer",
    title: "Load balancing algorithms",
    summary: "Compare how round-robin, random, hashing, and least-connections spread a skewed request stream.",
    params: [
      { key: "serverCount", label: "Servers", kind: "number", min: 2, max: 32, step: 1, default: 6 },
      { key: "requestCount", label: "Requests", kind: "log", min: 100, max: 100_000, step: 100, default: 5_000 },
      { key: "skew", label: "Request skew", kind: "percent", min: 0, max: 1, step: 0.05, default: 0.4 },
      {
        key: "algorithm",
        label: "Algorithm",
        kind: "choice",
        choices: [
          { value: 0, label: "Round robin" },
          { value: 1, label: "Least connections" },
          { value: 2, label: "Random" },
          { value: 3, label: "Hash (modulo)" },
        ],
        default: 0,
      },
    ],
  },

  "token-bucket": {
    id: "token-bucket",
    title: "Token bucket rate limiter",
    summary: "Tune bucket capacity and refill rate against a request arrival rate and watch accept/reject in real time.",
    params: [
      { key: "capacity", label: "Bucket capacity", kind: "number", min: 1, max: 500, step: 1, unit: "tokens", default: 50 },
      { key: "refillPerSec", label: "Refill rate", kind: "number", min: 1, max: 200, step: 1, unit: "tok/s", default: 20 },
      { key: "arrivalPerSec", label: "Arrival rate", kind: "number", min: 1, max: 300, step: 1, unit: "req/s", default: 30 },
      { key: "durationSec", label: "Duration", kind: "number", min: 5, max: 60, step: 5, unit: "s", default: 20 },
    ],
  },

  "consistent-hashing": {
    id: "consistent-hashing",
    title: "Consistent hashing ring",
    summary: "Add or remove a node and see how few keys actually move, versus naive modulo hashing.",
    params: [
      { key: "nodeCount", label: "Nodes", kind: "number", min: 2, max: 12, step: 1, default: 5 },
      { key: "virtualNodesPerNode", label: "Virtual nodes / node", kind: "number", min: 1, max: 200, step: 1, default: 50 },
      { key: "keyCount", label: "Keys", kind: "log", min: 100, max: 20_000, step: 100, default: 2_000 },
    ],
  },

  "queue-backpressure": {
    id: "queue-backpressure",
    title: "Queueing and backpressure",
    summary: "Push utilisation toward 1 and watch wait time diverge — the hockey-stick curve behind every capacity plan.",
    params: [
      { key: "arrivalRate", label: "Arrival rate", kind: "number", min: 1, max: 500, step: 1, unit: "req/s", default: 80 },
      { key: "serviceRate", label: "Service rate / worker", kind: "number", min: 1, max: 200, step: 1, unit: "req/s", default: 100 },
      { key: "workers", label: "Workers", kind: "number", min: 1, max: 20, step: 1, default: 1 },
    ],
  },

  "latency-numbers": {
    id: "latency-numbers",
    title: "Latency numbers every programmer should know",
    summary: "See the canonical reference latencies on a log scale, and how many of each fit inside a p99 budget.",
    params: [
      { key: "budgetMs", label: "p99 budget", kind: "log", min: 1, max: 2_000, step: 1, unit: "ms", default: 100 },
    ],
  },
};
