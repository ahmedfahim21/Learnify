import type { SystemDesignProblem } from "../types";

export const rateLimiter: SystemDesignProblem = {
  slug: "rate-limiter",
  title: "Rate Limiter",
  tagline: "Cap how fast a client can hit your API, without punishing everyone else for one client's burst.",
  difficulty: 1,
  estimatedMinutes: 20,
  tags: ["rate-limiting", "middleware", "distributed-systems"],
  functionalRequirements: [
    "Reject requests once a client exceeds an allowed rate (e.g. 100 req/min per API key).",
    "Return a clear signal (HTTP 429 + Retry-After) rather than a silent drop.",
    "Support different limits for different tiers of client.",
  ],
  nonFunctionalRequirements: [
    "The limiter itself must not become the bottleneck — checking a limit should add microseconds, not milliseconds.",
    "Limits must hold even when the API runs on many servers behind a load balancer.",
    "Should tolerate limiter downtime by failing open (let traffic through) rather than failing closed (block everyone).",
  ],
  chapters: [
    {
      phase: "requirements",
      title: "What is a rate limiter protecting?",
      summary: "The goal isn't fairness in the abstract — it's protecting a specific downstream resource from a specific kind of overload.",
      concepts: [
        { slug: "ratelimit-scope", name: "Why rate limit at all", summary: "A rate limiter exists to protect a downstream resource (a database, a costly third-party API, your own compute) from being overwhelmed by one client — accidental or malicious.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "Rate limiting sits between a client and the thing worth protecting. The two failure modes it guards against are different: a buggy client retrying in a tight loop (accidental), and a client deliberately trying to scrape or brute-force something (adversarial). Both call for the same mechanism — cap requests per identity per time window — but knowing which one you're defending against shapes how strict the limit and how it's communicated back." },
      ],
    },
    {
      phase: "estimation",
      title: "Sizing the limiter's own footprint",
      summary: "The limiter has to run on every request, so its own cost matters more than almost anything else in the system.",
      concepts: [
        { slug: "ratelimit-estimation", name: "Estimating limiter overhead", summary: "At high QPS, even a millisecond of limiter latency compounds. The limiter's state (counters per client) has to live somewhere sub-millisecond to read and write — that's what rules out a regular database.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "If your API does 50,000 requests/sec, the rate limiter runs 50,000 times a second too — on top of everything else the request does. A counter store that takes 5ms to read and write would add 250 seconds of aggregate latency per second of wall-clock time, which is obviously untenable. This is why rate limiters almost universally live in an in-memory store like Redis: sub-millisecond reads and writes, and atomic increment operations that don't need a read-modify-write round trip." },
      ],
    },
    {
      phase: "api",
      title: "Where the limiter plugs in",
      summary: "As middleware in front of every route, not as a feature any individual endpoint implements.",
      concepts: [
        { slug: "ratelimit-middleware", name: "Rate limiting as middleware", summary: "Implemented once, in front of all routes, so no endpoint can forget to apply it — and so limits can be tuned centrally.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "The limiter runs as middleware/a gateway layer in front of every route: it inspects the client identity (API key, user id, or IP), checks and updates the counter, and either passes the request through or returns `429 Too Many Requests` with a `Retry-After` header telling the client when it's safe to try again." },
      ],
    },
    {
      phase: "data-model",
      title: "What state does the limiter need?",
      summary: "One counter (or a small structure) per client identity per algorithm.",
      concepts: [
        { slug: "ratelimit-state", name: "Counter state per client", summary: "The minimal state is a count and a window start time per client key; more sophisticated algorithms trade a bit more state for smoother behavior.", difficulty: 2 },
      ],
      blocks: [
        { type: "prose", body: "At minimum: a key (the client identity) mapping to a request count and when the current window started. Redis models this naturally — `INCR` a key, and set its expiry to the window length on first increment, so the counter resets itself and needs no separate cleanup job." },
      ],
    },
    {
      phase: "high-level",
      title: "High-level design",
      summary: "A shared limiter store in front of the API fleet, so every instance enforces the same limit.",
      concepts: [
        { slug: "ratelimit-shared-state", name: "Why the counter must be shared", summary: "If each API server keeps its own in-process counter, a client can get N-times the intended limit by spreading requests across N servers. The counter has to live in a store every server shares.", difficulty: 2 },
      ],
      blocks: [
        {
          type: "diagram",
          diagram: {
            title: "Rate limiter — shared counter across the fleet",
            columns: 4,
            rows: 2,
            nodes: [
              { id: "client", label: "Client", icon: "client", col: 0, row: 0 },
              { id: "lb", label: "Load balancer", icon: "load-balancer", col: 1, row: 0, accent: "amber" },
              { id: "api1", label: "API server A", icon: "service", col: 2, row: 0, accent: "blue" },
              { id: "api2", label: "API server B", icon: "service", col: 2, row: 1, accent: "blue" },
              { id: "redis", label: "Shared counter store", sublabel: "Redis, INCR + TTL", icon: "cache", col: 3, row: 0, rowSpan: 2, accent: "cyan" },
            ],
            edges: [
              { id: "e1", from: "client", to: "lb", step: 1 },
              { id: "e2", from: "lb", to: "api1", step: 2, label: "routed to A this time" },
              { id: "e3", from: "api1", to: "redis", step: 3, label: "INCR client:key" },
              { id: "e4", from: "api2", to: "redis", step: 4, label: "same key, from B", route: "straight" },
            ],
            steps: [
              { index: 1, caption: "A request arrives at the load balancer.", nodeIds: ["client", "lb"], edgeIds: ["e1"] },
              { index: 2, caption: "It's routed to one of several stateless API servers — this time, A.", nodeIds: ["lb", "api1"], edgeIds: ["e2"] },
              { index: 3, caption: "Server A increments the client's counter in the shared store and checks it against the limit.", nodeIds: ["api1", "redis"], edgeIds: ["e3"] },
              { index: 4, caption: "The next request from the same client, routed to server B, hits the same counter — so the limit holds fleet-wide.", nodeIds: ["api2", "redis"], edgeIds: ["e4"] },
            ],
          },
        },
      ],
    },
    {
      phase: "deep-dive",
      title: "Deep dive: which algorithm?",
      summary: "Fixed window is simplest but bursty at the boundary; token bucket smooths bursts while still allowing them.",
      concepts: [
        { slug: "ratelimit-algorithms", name: "Fixed window vs. sliding window vs. token bucket", summary: "Fixed window is cheap but allows 2x the limit right at a window boundary. Sliding window log/counter fixes that at more storage cost. Token bucket allows controlled bursts on top of a sustained rate.", difficulty: 3 },
      ],
      blocks: [
        {
          type: "prose",
          heading: "The fixed-window boundary problem",
          body: "A naive fixed window (e.g. \"100 requests per calendar minute\") lets a client send 100 requests in the last second of one window and another 100 in the first second of the next — 200 requests in two seconds, double the intended rate. A sliding window (tracking a rolling log of timestamps, or an approximation via two adjacent counters) avoids this at the cost of more state per client.",
        },
        {
          type: "prose",
          heading: "Token bucket: the industry default",
          body: "A token bucket holds up to `capacity` tokens, refilling at `rate` tokens/sec; each request consumes one token, and a request with no tokens available is rejected. This is the algorithm behind most production rate limiters (including AWS's and Stripe's) because it cleanly separates two independent knobs: how much burst to tolerate (capacity) and what sustained rate to allow (refill rate).",
        },
        {
          type: "simulator",
          simulatorId: "token-bucket",
          notice: "Raise capacity without touching refill rate and watch the limiter tolerate a bigger burst at the start, while the long-run accept rate stays governed by the refill rate.",
          params: [{ key: "capacity", value: 20 }, { key: "refillPerSec", value: 10 }, { key: "arrivalPerSec", value: 25 }],
        },
      ],
    },
    {
      phase: "bottlenecks",
      title: "Where it breaks",
      summary: "The shared counter store is now a single point of failure and a new hop on every request.",
      concepts: [
        { slug: "ratelimit-failure-modes", name: "Fail open, and watch the store's own load", summary: "If the counter store is unreachable, the safe default is to let traffic through (fail open) rather than block all traffic (fail closed) — and the store itself needs the same scaling techniques (sharding, replication) as any other hot datastore.", difficulty: 3 },
      ],
      blocks: [
        {
          type: "callout",
          tone: "pitfall",
          body: "A rate limiter that fails closed turns its own outage into a total outage for your API. Fail open — a brief window of unlimited traffic during a limiter blip is almost always the lesser risk.",
        },
        {
          type: "prose",
          body: "At extreme scale, the counter store itself needs sharding (by client key, the same way a distributed cache shards) and the increment operation needs to be atomic without a round-trip lock — Redis's single-threaded `INCR` and Lua scripting for compound checks (increment-then-compare in one atomic op) are exactly why Redis, not a general database, is the default choice here.",
        },
      ],
    },
  ],
};
