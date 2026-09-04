import type { SystemDesignProblem } from "../types";

export const distributedCache: SystemDesignProblem = {
  slug: "distributed-cache",
  title: "Distributed Cache",
  tagline: "Spread a cache across many machines without losing most of it every time you add or remove one.",
  difficulty: 2,
  estimatedMinutes: 25,
  tags: ["caching", "consistent-hashing", "sharding"],
  functionalRequirements: [
    "Get/set a key-value pair with sub-millisecond latency.",
    "Scale horizontally by adding cache nodes as data volume grows.",
    "Evict least-recently-used entries when a node runs low on memory.",
  ],
  nonFunctionalRequirements: [
    "Adding or removing a node should remap as few keys as possible.",
    "No single node should hold a disproportionate share of keys or traffic.",
    "The cache should degrade gracefully — a node failure should be a partial, not total, cache miss.",
  ],
  chapters: [
    {
      phase: "requirements",
      title: "Why cache at all, and why distribute it?",
      summary: "A single-node cache runs out of memory and becomes a single point of failure; distributing it fixes both.",
      concepts: [
        { slug: "distcache-scope", name: "Scoping a distributed cache", summary: "A cache trades memory (expensive, finite) for latency (what you're optimizing). Once the working set outgrows one machine's RAM, the cache itself has to become a distributed system.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "A single-machine cache (in-process, or a single Redis instance) works until the hot data no longer fits in that machine's RAM, or until that machine's request rate saturates its network or CPU. Distributing the cache across many nodes solves both: more aggregate RAM, and more aggregate request throughput. The hard part is deciding which node owns which key — and what happens to that decision when a node is added or removed." },
      ],
    },
    {
      phase: "estimation",
      title: "Sizing the cluster",
      summary: "From a working-set size and a per-node memory budget, derive how many nodes you actually need.",
      concepts: [
        { slug: "distcache-sizing", name: "Estimating node count", summary: "Working set size / usable memory per node, with headroom for eviction and replication — not exact division, since a node running near 100% full thrashes.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "If the hot working set is 500 GB and each cache node runs with 32 GB of usable memory (after leaving headroom for the OS and avoiding thrashing near capacity), that's a minimum of roughly 16-20 nodes — rounding up, since a cache node kept near 100% full evicts constantly and its hit ratio collapses." },
      ],
    },
    {
      phase: "api",
      title: "The client-facing API",
      summary: "Get, set, delete — the operations themselves are simple; the routing behind them is the whole problem.",
      concepts: [
        { slug: "distcache-api", name: "GET / SET / DELETE", summary: "The API is deliberately minimal — three operations. All the design complexity is in routing a key to the right node, not in the operations themselves.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "`GET key`, `SET key value [ttl]`, `DELETE key`. A client library (or a proxy layer) is responsible for hashing the key and routing the request to the node that owns it — the caller never needs to know the cluster topology." },
      ],
    },
    {
      phase: "data-model",
      title: "What each node stores",
      summary: "Each node runs its own independent in-memory key-value map with its own LRU eviction policy.",
      concepts: [
        { slug: "distcache-node-storage", name: "Per-node LRU map", summary: "Each node is, on its own, exactly the single-machine cache from the requirements chapter — a hash map plus an LRU eviction list, sized to that node's memory budget.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "Each individual node is unremarkable: a hash map of key to value, with a doubly-linked list tracking recency so the least-recently-used entry can be evicted in O(1) when the node hits its memory limit. The distributed system properties come entirely from how keys are assigned to nodes — the topic of this course's high-level design." },
      ],
    },
    {
      phase: "high-level",
      title: "High-level design: routing keys to nodes",
      summary: "Naive modulo hashing reshuffles almost everything when the cluster resizes. Consistent hashing doesn't.",
      concepts: [
        { slug: "distcache-consistent-hashing", name: "Consistent hashing", summary: "Nodes and keys are hashed onto the same ring; a key is owned by the next node clockwise. Adding or removing a node only remaps the keys between it and its neighbor — roughly 1/N of the total, not nearly all of it.", difficulty: 3 },
      ],
      blocks: [
        {
          type: "prose",
          heading: "The problem with hash(key) % N",
          body: "The obvious routing scheme — hash the key, take it modulo the node count — has a fatal flaw: changing N (adding or removing even one node) changes the modulo result for almost every key, invalidating nearly the entire cache at once. At scale, that's a cache-miss stampede against your origin the moment you try to grow the cluster.",
        },
        {
          type: "prose",
          heading: "The ring",
          body: "Consistent hashing places both nodes and keys on the same circular hash space (a \"ring\"). A key is owned by the first node found walking clockwise from the key's position. Adding a node only takes over the keys between it and the next node clockwise — everyone else's ownership is untouched. To avoid uneven load (an unlucky node landing on a big gap in the ring), each physical node is placed at many points on the ring (\"virtual nodes\"), which also smooths out load when node counts are small.",
        },
        {
          type: "diagram",
          diagram: {
            title: "Consistent hashing ring",
            columns: 4,
            rows: 3,
            nodes: [
              { id: "key1", label: "key: \"user:42\"", detail: "A single key hashes to one fixed point on the ring. That position never changes, no matter how many nodes come or go — which is the whole trick.", icon: "generic", col: 0, row: 0, shape: "pill" },              { id: "nodeA", label: "Node A", detail: "A cache node, itself just a hash map with LRU eviction. All the distributed-system behaviour comes from where it sits on the ring, not from anything inside it.", icon: "cache", col: 1, row: 0, accent: "blue" },              { id: "nodeB", label: "Node B", detail: "Owns every key between it and the previous node, walking clockwise. Adding Node D steals only part of that arc.", icon: "cache", col: 2, row: 0, accent: "green" },              { id: "nodeC", label: "Node C", detail: "Untouched when D is added. Under naive modulo hashing this node's entire keyset would have been reshuffled instead.", icon: "cache", col: 3, row: 0, accent: "amber" },              { id: "nodeD", label: "Node D (new)", detail: "The newly added node. It takes over only the arc between A and B — roughly 1/N of all keys — leaving every other node's ownership intact.", icon: "cache", col: 2, row: 2, accent: "pink" },            ],
            edges: [
              { id: "e1", from: "key1", to: "nodeB", label: "owned by next node clockwise", step: 1 },
              { id: "e2", from: "nodeD", to: "nodeB", label: "D inserted before B; only B's slice remaps", style: "dashed", step: 2 },
            ],
            steps: [
              { index: 1, caption: "A key hashes to a point on the ring and is owned by the next node clockwise — here, Node B.", nodeIds: ["key1", "nodeB"], edgeIds: ["e1"] },
              { index: 2, caption: "Adding Node D between A and B only remaps the slice of keys that used to belong to B — everything else is untouched.", nodeIds: ["nodeD", "nodeB"], edgeIds: ["e2"] },
            ],
          },
        },
        {
          type: "simulator",
          simulatorId: "consistent-hashing",
          notice: "Add a node and watch only a small, even slice of keys move — then compare to how much would move under naive modulo hashing (nearly everything).",
          params: [{ key: "nodeCount", value: 5 }, { key: "virtualNodesPerNode", value: 50 }],
        },
        {
            type: "quiz",
            question: "You run 10 cache nodes with hash(key) % N routing and add one more. Roughly what fraction of keys end up on a different node?",
            options: [
              { id: "a", label: "About 1/11 — only the new node's share moves" },
              { id: "b", label: "About 10% — one node's worth" },
              { id: "c", label: "Nearly all of them" },
              { id: "d", label: "None — modulo hashing is stable" },
            ],
            correctOptionId: "c",
            explanation: "Changing N changes the modulo result for almost every key, so the cache effectively empties itself at the exact moment you're adding capacity — a stampede of misses straight through to the origin. Consistent hashing moves only the ~1/N of keys that the new node takes over.",
          },
        ],
    },
    {
      phase: "deep-dive",
      title: "Deep dive: replication and failure",
      summary: "Replicate each key to N-1 neighboring nodes on the ring so one node's failure isn't a total loss.",
      concepts: [
        { slug: "distcache-replication", name: "Ring-neighbor replication", summary: "Storing each key on the next R nodes clockwise (not just the first) means a single node failure only degrades, rather than eliminates, that key's availability — and the replicas are a natural, deterministic set with no extra coordination.", difficulty: 3 },
      ],
      blocks: [
        {
          type: "prose",
          body: "Because the ring already gives a deterministic ordering of nodes for any key, replication is nearly free to add: instead of storing a key only at the first node clockwise, store it at the first R nodes clockwise (a replication factor of R). If any one of those R nodes is down, the key is still servable from the others — no separate replica-selection logic needed, since the ring ordering already defines it.",
        },
        {
            type: "diagram",
            diagram: {
              title: "Replication follows the ring",
              columns: 4,
              rows: 2,
              nodes: [
                { id: "k", label: "key", detail: "Hashes to one fixed point on the ring. Everything below follows deterministically from that position.", icon: "generic", col: 0, row: 0, shape: "pill" },
                { id: "n1", label: "Node B", sublabel: "primary", detail: "First node clockwise from the key. Serves reads and writes for it under normal operation.", icon: "cache", col: 1, row: 0, accent: "green" },
                { id: "n2", label: "Node C", sublabel: "replica 2", detail: "Next clockwise. Holds a copy purely because of ring order — no replica-placement service decides this.", icon: "cache", col: 2, row: 0, accent: "blue" },
                { id: "n3", label: "Node D", sublabel: "replica 3", detail: "Third clockwise. With R=3, any two of these can fail and the key is still servable.", icon: "cache", col: 3, row: 0, accent: "blue" },
                { id: "fail", label: "Node B fails", detail: "Reads fail over to the next replica clockwise. No coordination round is needed — every client can compute the same fallback independently.", icon: "firewall", col: 1, row: 1, accent: "rose" },
              ],
              edges: [
                { id: "v1", from: "k", to: "n1", step: 1, label: "first clockwise" },
                { id: "v2", from: "n1", to: "n2", step: 2, label: "replicate" },
                { id: "v3", from: "n2", to: "n3", step: 3, label: "replicate" },
                { id: "v4", from: "fail", to: "n2", step: 4, label: "reads fail over", route: "vertical-first" },
              ],
              steps: [
                { index: 1, caption: "The key's ring position picks its primary — the first node clockwise.", nodeIds: ["k", "n1"], edgeIds: ["v1"] },
                { index: 2, caption: "The next R-1 nodes clockwise hold replicas. Ring order *is* the replica set.", nodeIds: ["n1", "n2"], edgeIds: ["v2"] },
                { index: 3, caption: "With R=3 the key survives two simultaneous node failures.", nodeIds: ["n2", "n3"], edgeIds: ["v3"] },
                { index: 4, caption: "When the primary dies, every client independently computes the same next replica — no election needed.", nodeIds: ["fail", "n2"], edgeIds: ["v4"] },
              ],
            },
          },
        ],
    },
    {
      phase: "bottlenecks",
      title: "Where it breaks",
      summary: "Hot keys defeat even a perfectly balanced ring, because popularity isn't uniform.",
      concepts: [
        { slug: "distcache-hot-keys", name: "The hot-key problem", summary: "Consistent hashing balances key *count* evenly, but not key *popularity*. One viral key can still overload the single node that owns it, no matter how even the ring is.", difficulty: 4 },
      ],
      blocks: [
        {
          type: "callout",
          tone: "pitfall",
          body: "A famous failure mode: a celebrity's profile, a trending product, or a viral post becomes one \"hot key\" that a huge fraction of traffic hits. Consistent hashing spreads keys evenly, but it can't spread the traffic to a *single* key across nodes — that key still lives on one node (or its R replicas).",
        },
        {
          type: "prose",
          body: "The fix isn't in the routing layer — it's application-level: detect hot keys and replicate *that specific key* to many more nodes than the standard replication factor, or cache it one layer closer to the client (a local, per-API-server cache of just the hottest few hundred keys) so the distributed cache never sees most of that traffic at all.",
        },
      ],
    },
  ],
};
