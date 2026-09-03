import type { SystemDesignProblem } from "../types";

export const keyValueStore: SystemDesignProblem = {
  slug: "key-value-store",
  title: "Key-Value Store",
  tagline: "Build the storage layer behind DynamoDB and Cassandra: partitioned, replicated, and tunably consistent.",
  difficulty: 3,
  estimatedMinutes: 30,
  tags: ["storage", "consistency", "replication", "sharding"],
  functionalRequirements: [
    "put(key, value) and get(key), each resolving in low single-digit milliseconds.",
    "Scale to far more data and traffic than any single machine can hold.",
    "Stay available for reads and writes even when some nodes are down.",
  ],
  nonFunctionalRequirements: [
    "Horizontal scalability — add nodes to add capacity, no re-architecture.",
    "Tunable consistency: some workloads want strict correctness, others want maximum availability.",
    "No single point of failure anywhere in the write or read path.",
  ],
  chapters: [
    {
      phase: "requirements",
      title: "What makes this different from a relational database?",
      summary: "No joins, no complex queries — just a partition key. That constraint is what makes horizontal scale tractable.",
      concepts: [
        { slug: "kv-scope", name: "The key-value contract", summary: "Give up joins and ad-hoc queries; in exchange, every operation addresses exactly one key, which is what makes partitioning the data across many machines straightforward.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "A relational database's flexibility — joins, secondary indexes, arbitrary WHERE clauses — is exactly what makes it hard to shard: a query might need data from many partitions. A key-value store gives up that flexibility deliberately: every read or write names one key, so the system can place any given key on any given machine and always know exactly where to find it. That single constraint is the whole reason key-value stores scale horizontally more easily than relational ones." },
      ],
    },
    {
      phase: "estimation",
      title: "Scale numbers",
      summary: "The kind of scale that justifies giving up relational features in the first place.",
      concepts: [
        { slug: "kv-estimation", name: "Estimating cluster scale", summary: "Key-value stores exist for the scale tier where a single powerful machine is no longer an option — terabytes to petabytes of data, millions of QPS.", difficulty: 1 },
      ],
      blocks: [
        { type: "prose", body: "Say the store holds 10 billion key-value pairs averaging 1 KB each — 10 TB of raw data, which after a replication factor of 3 (for durability) becomes 30 TB actually stored. At even 100,000 requests/sec, no single machine's disk or network can keep up; this is squarely the regime a horizontally-partitioned store is built for." },
      ],
    },
    {
      phase: "api",
      title: "The API",
      summary: "put and get, plus optional versioning metadata for conflict resolution.",
      concepts: [
        { slug: "kv-api", name: "put/get and vector clocks", summary: "The client-facing API is minimal, but a put often needs to carry version metadata (a vector clock) so the system can later tell whether two writes conflicted or one simply happened after the other.", difficulty: 2 },
      ],
      blocks: [
        { type: "prose", body: "`put(key, value, context)` and `get(key)`, where `context` carries versioning metadata from a prior `get`. That context is what lets the system distinguish \"this write happened after that one\" from \"these two writes conflict and both need to be kept\" — essential once multiple replicas can each accept writes independently." },
      ],
    },
    {
      phase: "data-model",
      title: "Partitioning the keyspace",
      summary: "Consistent hashing again — the same ring that balances a distributed cache balances a key-value store's partitions.",
      concepts: [
        { slug: "kv-partitioning", name: "Consistent hashing for data partitions", summary: "Each key hashes onto a ring of partitions; a partition (not a whole machine) is the unit that gets assigned to and moved between physical nodes, which makes rebalancing finer-grained.", difficulty: 3 },
      ],
      blocks: [
        { type: "prose", body: "Just as in a distributed cache, keys are placed on a hash ring and owned by ranges of that ring. The refinement a durable store adds: the ring is divided into many more partitions than there are physical nodes, and each node owns several partitions. Rebalancing then means moving whole partitions between nodes — a coarser, easier-to-reason-about unit than individual keys, and one that spreads a rebalance's cost across many nodes at once." },
      ],
    },
    {
      phase: "high-level",
      title: "High-level design: writes and reads with quorums",
      summary: "Every key is replicated to N nodes; a write or read only needs to succeed on a quorum of them.",
      concepts: [
        { slug: "kv-quorum", name: "Quorum reads and writes (N, W, R)", summary: "With replication factor N, a write succeeds after W replicas ack it and a read succeeds after querying R replicas — and W + R > N guarantees every read sees the latest write.", difficulty: 4 },
      ],
      blocks: [
        {
          type: "prose",
          heading: "The N/W/R model",
          body: "Each key is replicated to N nodes (say N=3). A write is considered successful once W of them acknowledge it (W=2 is common); a read queries R of them and returns the most recent version seen (R=2 is common). The guarantee that matters: if W + R > N, every read is guaranteed to overlap with at least one replica that has the latest write — that's what makes the system strongly consistent despite no single node holding the full picture.",
        },
        {
          type: "diagram",
          diagram: {
            title: "Quorum write, N=3, W=2",
            columns: 4,
            rows: 3,
            nodes: [
              { id: "client", label: "Client", detail: "Issues put/get against any node in the cluster. It never needs to know which replicas hold the key.", icon: "client", col: 0, row: 1 },              { id: "coordinator", label: "Coordinator node", detail: "Whichever node received the request. It fans the write out to the key's N replicas and counts acknowledgements — it is not a master, just this request's coordinator.", icon: "service", col: 1, row: 1, accent: "blue" },              { id: "r1", label: "Replica 1", detail: "One of N=3 replicas for this key, chosen by walking the hash ring clockwise from the key's position.", icon: "database", col: 3, row: 0, accent: "green" },              { id: "r2", label: "Replica 2", detail: "The second acknowledgement. With W=2 the write is already durable enough to confirm, so the client stops waiting here.", icon: "database", col: 3, row: 1, accent: "green" },              { id: "r3", label: "Replica 3", detail: "Slow or partitioned. The write still succeeds — and this replica catches up later via hinted handoff or read repair, which is exactly the availability the quorum model buys.", icon: "database", col: 3, row: 2, accent: "slate" },            ],
            edges: [
              { id: "e1", from: "client", to: "coordinator", step: 1, label: "put(key, value)" },
              { id: "e2", from: "coordinator", to: "r1", step: 2 },
              { id: "e3", from: "coordinator", to: "r2", step: 2 },
              { id: "e4", from: "coordinator", to: "r3", step: 2, style: "dashed", label: "slow / unreachable" },
              { id: "e5", from: "r1", to: "coordinator", step: 3, label: "ack" },
              { id: "e6", from: "r2", to: "coordinator", step: 3, label: "ack" },
            ],
            steps: [
              { index: 1, caption: "The client sends a write to a coordinator node responsible for this key.", nodeIds: ["client", "coordinator"], edgeIds: ["e1"] },
              { index: 2, caption: "The coordinator forwards the write to all N=3 replicas.", nodeIds: ["coordinator", "r1", "r2", "r3"], edgeIds: ["e2", "e3", "e4"] },
              { index: 3, caption: "As soon as W=2 replicas acknowledge, the write succeeds — the coordinator doesn't wait on the third.", nodeIds: ["r1", "r2", "coordinator"], edgeIds: ["e5", "e6"] },
            ],
          },
        },
      ],
    },
    {
      phase: "deep-dive",
      title: "Deep dive: handling conflicting writes",
      summary: "When two replicas accept concurrent writes, something has to reconcile them — vector clocks make \"concurrent\" detectable.",
      concepts: [
        { slug: "kv-conflict-resolution", name: "Vector clocks and last-write-wins", summary: "A vector clock tracks per-replica write counts to detect true concurrency (both writes must be kept) versus a strict happens-before relationship (the newer write wins outright).", difficulty: 4 },
      ],
      blocks: [
        {
          type: "prose",
          body: "If replicas can each accept writes (to stay available during a partition), two clients can concurrently write different values for the same key on different replicas. A plain timestamp can't tell \"genuinely concurrent\" apart from \"clock skew made B look later than A\" — a vector clock (a per-replica counter attached to each version) can: if one version's clock dominates another's, it happened strictly after and wins outright; if neither dominates, they're truly concurrent and the application (or a simple last-write-wins timestamp rule, accepting the risk of losing an update) has to reconcile them.",
        },
        {
          type: "callout",
          tone: "tradeoff",
          body: "Last-write-wins is simpler to implement than vector clocks but silently drops one of two concurrent writes. Whether that's acceptable depends entirely on the workload — fine for a view counter, unacceptable for a shopping cart.",
        },
      ],
    },
    {
      phase: "bottlenecks",
      title: "Where it breaks: partitions and CAP",
      summary: "During a network partition you must choose: stay available and risk inconsistency, or refuse writes to stay consistent.",
      concepts: [
        { slug: "kv-cap-theorem", name: "CAP theorem in practice", summary: "When a network partition happens, you can't have both full consistency and full availability — quorum systems make this trade-off tunable per-request via N, W, and R rather than fixed system-wide.", difficulty: 4 },
      ],
      blocks: [
        {
          type: "prose",
          body: "CAP theorem: under a network partition, a distributed system must choose between consistency (every read sees the latest write, but some nodes may refuse requests they can't guarantee are correct) and availability (every node answers every request, but some may return stale data). The N/W/R quorum model doesn't dodge this trade-off — it makes it tunable: W=N, R=1 favors read availability; W=1, R=N favors write availability; W+R>N with both above N/2 favors consistency. Different keys in the same cluster can even choose differently.",
        },
      ],
    },
  ],
};
