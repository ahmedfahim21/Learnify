import type { SystemDesignProblem } from "../types";

export const distributedMessageQueue: SystemDesignProblem = {
  slug: "distributed-message-queue",
  title: "Distributed Message Queue",
  tagline: "Build the durable, ordered, horizontally-scalable backbone behind Kafka — decoupling producers from consumers at any throughput.",
  difficulty: 4,
  estimatedMinutes: 26,
  tags: ["messaging", "queueing", "distributed-systems"],
  functionalRequirements: [
    "Producers publish messages to a topic; consumers subscribe and read them.",
    "Multiple consumers can process the same topic independently, or share the load as a group.",
    "Messages persist durably — a consumer that's down for an hour can catch up later.",
  ],
  nonFunctionalRequirements: [
    "High sustained throughput — millions of messages/sec across a cluster.",
    "Ordering guarantees, at least within a defined subset of messages.",
    "Durability — an acknowledged message must survive a broker crash.",
  ],
  chapters: [
    {
      phase: "requirements",
      title: "Decoupling producers from consumers",
      summary: "The core value proposition: a producer doesn't need to know who's consuming, how many there are, or whether they're keeping up.",
      concepts: [
        { slug: "mq-scope", name: "Why a queue instead of direct calls", summary: "A producer calling a consumer's API directly couples their availability and throughput together. A queue in between lets each scale, fail, and deploy independently — the producer just writes; consumers read at their own pace.", difficulty: 1, tags: ["scoping", "queueing"] },
      ],
      blocks: [
        { type: "prose", body: "If a service that logs events called every downstream consumer (analytics, fraud detection, a search indexer) directly and synchronously, it would be as slow as its slowest consumer, and would fail if any one consumer was down. A message queue in between removes that coupling entirely: the producer writes to the queue and moves on; each consumer reads at its own pace, and a slow or down consumer never blocks the producer or any other consumer." },
      ],
    },
    {
      phase: "estimation",
      title: "Throughput and retention",
      summary: "Sustained write throughput and how long messages need to stay available are the two numbers that size the cluster.",
      concepts: [
        { slug: "mq-estimation", name: "Estimating throughput and retention footprint", summary: "Messages/sec times average message size gives write bandwidth; that times a retention window (how long messages stay readable before being deleted) gives total storage footprint.", difficulty: 1, tags: ["estimation", "queueing"] },
      ],
      blocks: [
        { type: "prose", body: "At 1 million messages/sec averaging 1 KB each, that's 1 GB/sec of write bandwidth — already beyond what a single machine's disk can sustain, which is exactly why the log is partitioned across many machines (the high-level design chapter). With a 7-day retention window, total storage is roughly 1 GB/sec x 604,800 seconds ≈ 600 TB, spread across the cluster." },
      ],
    },
    {
      phase: "api",
      title: "The API",
      summary: "Producers append; consumers read from a position they track themselves.",
      concepts: [
        { slug: "mq-api", name: "produce/consume with consumer-tracked offsets", summary: "produce(topic, message) appends. consume(topic, partition, offset) reads from a specific position — critically, the consumer (not the broker) tracks how far it has read, which is what makes replay and independent consumer groups possible.", difficulty: 2, tags: ["api-design", "queueing"] },
      ],
      blocks: [
        { type: "prose", body: "`produce(topic, message)` appends to the log. `consume(topic, partition, fromOffset)` reads starting at a given position. The key design choice: the broker doesn't remove a message once it's been read, and doesn't track \"has this been consumed\" per consumer — each consumer tracks its own offset (how far it's read). This is what lets multiple independent consumers read the same topic at their own pace, and lets a consumer replay messages by simply resetting its own offset backward." },
      ],
    },
    {
      phase: "data-model",
      title: "The append-only log",
      summary: "A topic's data is an ordered, immutable, append-only sequence — the single simplest and most scalable structure for this problem.",
      concepts: [
        { slug: "mq-log-structure", name: "Append-only log per partition", summary: "Each partition is a simple sequential file: new messages are always appended to the end, each gets a monotonically increasing offset, and nothing is ever modified in place — sequential disk writes are extremely fast, which is a large part of why this design achieves such high throughput.", difficulty: 2, tags: ["durability", "data-modeling"] },
      ],
      blocks: [
        { type: "prose", body: "Rather than a database with updates and deletes, each partition is literally an append-only log file: new messages go at the end, get the next sequential offset, and are never modified. Sequential writes to disk are dramatically faster than random writes — this structural simplicity is a big part of why message queues built this way (Kafka being the canonical example) sustain such high write throughput compared to a general-purpose database." },
      ],
    },
    {
      phase: "high-level",
      title: "High-level design: partitions and consumer groups",
      summary: "A topic splits into partitions for parallelism; a consumer group splits the partitions among its members so the group processes the whole topic together, once each.",
      concepts: [
        { slug: "mq-partitioning-consumer-groups", name: "Partitions distribute load; consumer groups distribute consumption", summary: "A topic is split into N partitions, each an independent append-only log that can live on a different broker. Within a consumer group, each partition is read by exactly one consumer — adding consumers up to the partition count adds parallelism.", difficulty: 4, tags: ["partitioning", "load-balancing", "queueing"] },
      ],
      blocks: [
        {
          type: "prose",
          body: "A topic isn't one log — it's split into a fixed number of partitions, each an independent append-only log, typically living on different broker machines. This gives two kinds of parallelism at once: producers can write to different partitions concurrently (higher write throughput than one log could sustain), and within a **consumer group**, each partition is assigned to exactly one consumer, so a group of 4 consumers reading an 8-partition topic each handle 2 partitions in parallel. This is also what bounds parallelism: you can't usefully have more active consumers in a group than partitions.",
        },
        {
          type: "diagram",
          diagram: {
            title: "Partitions and consumer groups",
            columns: 5,
            rows: 3,
            nodes: [
              { id: "producer", label: "Producer", detail: "Appends messages and moves on. It never learns who consumes them, how many consumers there are, or whether they're keeping up.", icon: "service", col: 0, row: 1 },              { id: "p0", label: "Partition 0", detail: "One partition: an append-only log file. Sequential disk writes are what make this design so much faster than a general-purpose database.", icon: "stream", col: 2, row: 0, accent: "blue" },              { id: "p1", label: "Partition 1", detail: "Partitions are the unit of parallelism. More partitions means more concurrent producers and more consumers that can work in parallel.", icon: "stream", col: 2, row: 1, accent: "blue" },              { id: "p2", label: "Partition 2", detail: "Ordering is guaranteed within this log and nowhere else — which is why the producer's partition key choice decides what stays ordered together.", icon: "stream", col: 2, row: 2, accent: "blue" },              { id: "c1", label: "Consumer 1", detail: "Reads two partitions because the group has fewer consumers than partitions. It tracks its own offset, so it can replay simply by rewinding.", icon: "worker", col: 4, row: 0, accent: "green" },              { id: "c2", label: "Consumer 2", detail: "Reads one partition. Add a third consumer and the group rebalances to one partition each; add a fourth and it sits idle.", icon: "worker", col: 4, row: 1, accent: "green" },            ],
            groups: [{ id: "grp", label: "Consumer group", color: "green" }],
            edges: [
              { id: "e1", from: "producer", to: "p0", step: 1, label: "keyed writes" },
              { id: "e2", from: "producer", to: "p1", step: 1 },
              { id: "e3", from: "producer", to: "p2", step: 1 },
              { id: "e4", from: "p0", to: "c1", step: 2, label: "assigned" },
              { id: "e5", from: "p1", to: "c2", step: 2, label: "assigned" },
              { id: "e6", from: "p2", to: "c1", step: 2, label: "c1 handles 2 partitions" },
            ],
            steps: [
              { index: 1, caption: "The producer writes across all three partitions of the topic.", nodeIds: ["producer", "p0", "p1", "p2"], edgeIds: ["e1", "e2", "e3"] },
              { index: 2, caption: "With only 2 consumers in the group for 3 partitions, one consumer handles two partitions — the group still covers the whole topic exactly once.", nodeIds: ["p0", "p1", "p2", "c1", "c2"], edgeIds: ["e4", "e5", "e6"] },
            ],
          },
        },
      ],
    },
    {
      phase: "deep-dive",
      title: "Deep dive: ordering guarantees",
      summary: "Ordering is guaranteed within a partition, not across the whole topic — the producer's partitioning key decides what stays ordered together.",
      concepts: [
        { slug: "mq-ordering", name: "Per-partition ordering, keyed writes", summary: "Messages within one partition are strictly ordered (append order = read order). Across partitions there's no guarantee at all — so a producer that needs \"all events for user 42, in order\" must hash on user id to route them to the same partition every time.", difficulty: 4, tags: ["ordering", "partitioning"] },
      ],
      blocks: [
        {
          type: "prose",
          body: "The queue only promises order within a single partition — messages written to different partitions can be read in any relative order. This is a deliberate trade-off: strict total ordering across an entire topic would mean a single writer bottleneck, defeating the whole point of partitioning. If your use case needs \"every event about user 42, in the order they happened\" but doesn't care about ordering *between* different users, the producer hashes on user id to consistently route that user's events to the same partition — order within the partition is then exactly the order you need.",
        },
        {
          type: "callout",
          tone: "tradeoff",
          body: "Choosing a good partition key is one of the most consequential decisions in using a system like this: too coarse (e.g. one key for everything) recreates the single-writer bottleneck; too fine-grained relative to your ordering needs can spread related events across partitions and lose the ordering guarantee you actually needed.",
        },
        {
            type: "quiz",
            question: "You need every event for a given user processed in order. What does that require?",
            options: [
              { id: "a", label: "A single partition for the whole topic" },
              { id: "b", label: "Routing that user's events to the same partition, via a partition key" },
              { id: "c", label: "Exactly one consumer in the group" },
              { id: "d", label: "Nothing — the queue guarantees global ordering" },
            ],
            correctOptionId: "b",
            explanation: "Ordering is guaranteed within a partition and nowhere else. Hashing on user id sends that user's events to one partition, so they're read in the order written — while other users' events still spread across partitions for parallelism. One partition for the whole topic would also work, and would throw away all the throughput.",
          },
        ],
    },
    {
      phase: "bottlenecks",
      title: "Where it breaks",
      summary: "A single broker holding a partition is a single point of failure until that partition is itself replicated.",
      concepts: [
        { slug: "mq-replication", name: "Partition replication and leader election", summary: "Each partition is replicated to multiple brokers, with one elected leader handling all reads/writes for it and the others as in-sync followers ready to take over if the leader fails.", difficulty: 4, tags: ["replication", "availability"] },
      ],
      blocks: [
        {
          type: "prose",
          body: "If a partition lived on exactly one broker, that broker's failure would make the partition unavailable and could lose unacknowledged messages entirely. Production message queues replicate each partition across multiple brokers (a replication factor of 3 is typical); one replica is elected leader and handles all reads and writes, while the others stay in sync as followers. If the leader broker fails, one of the in-sync followers is promoted, and producers/consumers are redirected — a partition-level version of the same replication idea used in the Key-Value Store course.",
        },
        {
            type: "simulator",
            simulatorId: "queue-backpressure",
            title: "Consumer lag",
            notice: "Consumers are the service rate, producers the arrival rate. Because the log is durable, exceeding capacity doesn't drop messages — it grows lag. Add workers (up to the partition count) and watch the wait collapse.",
            params: [{ key: "arrivalRate", value: 380 }, { key: "serviceRate", value: 100 }, { key: "workers", value: 4 }],
          },
        ],
    },
  ],
};
