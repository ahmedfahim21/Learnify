import type { SystemDesignProblem } from "../types";

export const replication: SystemDesignProblem = {
  slug: "replication",
  title: "Replication",
  tagline: "Keep more than one copy of your data, and decide what you are willing to give up to keep them agreeing.",
  difficulty: 3,
  estimatedMinutes: 28,
  tags: ["storage", "availability", "consistency"],
  functionalRequirements: [
    "Survive the loss of a machine without losing data or refusing service.",
    "Serve reads from more than one machine.",
    "Bring a replica that has fallen behind, or been rebuilt, back into sync.",
  ],
  nonFunctionalRequirements: [
    "A write must not be acknowledged unless it will survive the failure of the node that took it.",
    "Read capacity should scale with replica count.",
    "The staleness a reader can observe must be bounded and understood, not accidental.",
  ],
  chapters: [
    {
      phase: "requirements",
      title: "Why keep more than one copy",
      summary: "Three different goals get bundled under one word, and they pull in different directions.",
      concepts: [
        { slug: "repl-goals", name: "Durability, availability, read capacity", summary: "Copies protect against data loss, keep serving during a failure, and add read throughput. The same mechanism delivers all three, but tuning for one can cost another.", difficulty: 2, tags: ["replication", "durability"] },
        { slug: "repl-vs-backup", name: "Replication is not backup", summary: "Replication faithfully copies whatever the primary does — including a bad migration or a mistaken DELETE. A backup is a point in time you can return to; a replica is a mirror of the present, mistakes included.", difficulty: 2, tags: ["replication", "durability"] },
      ],
      blocks: [
        { type: "prose", heading: "Three goals, one mechanism", body: "\"Replication\" bundles three separate wants. **Durability**: a disk dies and the data still exists. **Availability**: a machine dies and requests still get answered. **Read capacity**: reads outnumber writes, so extra copies mean extra read throughput. They are usually served by the same machinery, which makes it easy to assume that getting one gets you all three — and it does not. A configuration that maximises read capacity can be one that loses recent writes." },
        { type: "callout", tone: "pitfall", body: "Replication is not a backup. A replica applies whatever the primary did, faithfully and within milliseconds — including the migration that dropped a column and the DELETE that forgot its WHERE clause. Backups exist because you sometimes need a copy of the past, and every replica is a copy of the present." },
      ],
    },
    {
      phase: "estimation",
      title: "What replication costs",
      summary: "Every copy multiplies write traffic and storage while doing nothing for write throughput.",
      concepts: [
        { slug: "repl-cost", name: "The write amplification of copies", summary: "A replication factor of 3 means every write is performed three times and stored three times. Replicas add read capacity and durability; they never add write capacity.", difficulty: 2, tags: ["replication", "estimation"] },
      ],
      blocks: [
        { type: "prose", body: "With a replication factor of three, each logical write becomes three physical writes and three copies on disk. 10 TB of data is 30 TB provisioned; 1,000 writes/sec is 3,000 write operations across the cluster. This is the asymmetry worth internalising: **replicas multiply read capacity and never touch write capacity**. A workload that is write-bound gets nothing from more replicas — it needs partitioning, which is the Key-Value Store concept's answer." },
        { type: "simulator", simulatorId: "replication-lag", title: "When a replica falls behind", notice: "Below capacity, lag is just the network hop and barely moves. Push writes past the replica's apply rate and watch lag climb with how long the overload lasts — lag is a backlog, not a constant.", params: [{ key: "writeRate", value: 400 }, { key: "applyRate", value: 500 }, { key: "networkMs", value: 8 }, { key: "sustainedSec", value: 30 }, { key: "replicaCount", value: 3 }] },
      ],
    },
    {
      phase: "api",
      title: "Where a write is allowed to land",
      summary: "One writer, or many, is the fork everything else follows from.",
      concepts: [
        { slug: "repl-topology", name: "Single-leader, multi-leader, leaderless", summary: "One node accepting writes makes ordering trivial and the leader a bottleneck. Many writers remove that bottleneck and introduce write conflicts that something must resolve.", difficulty: 3, tags: ["replication", "availability"] },
      ],
      blocks: [
        { type: "prose", body: "**Single-leader.** All writes go to one node, which streams them to followers. Ordering is trivial — there is one sequence of events, defined by the leader — and conflicts cannot occur, because there is only one writer. The cost is that the leader bounds write throughput and its failure requires an election.\n\n**Multi-leader.** Several nodes accept writes, typically one per region so writers get a local round trip. Now two regions can modify the same row at the same time, and the system must decide what that means. You have traded a bottleneck for a conflict-resolution problem.\n\n**Leaderless.** Any replica takes any write, and correctness comes from quorums rather than from a designated node — the model in the Key-Value Store concept. No election to get wrong, no leader to lose, but every read and write is now a coordination decision." },
        { type: "callout", tone: "tradeoff", body: "The temptation is to reach for multi-leader because a single leader looks like an obvious bottleneck. In practice one leader handles a great deal of write traffic, and conflict resolution is genuinely hard to get right. Reach for it when geography forces you to, not because the topology diagram looks unbalanced." },
      ],
    },
    {
      phase: "data-model",
      title: "What actually travels between nodes",
      summary: "Copying the statement, or copying its effect — and why the difference bites.",
      concepts: [
        { slug: "repl-log-shipping", name: "Statement vs. row-based replication", summary: "Shipping the SQL is compact but breaks on anything non-deterministic — NOW(), RANDOM(), an auto-increment race. Shipping the resulting row changes is larger on the wire and always reproduces exactly what happened.", difficulty: 3, tags: ["replication", "ordering"] },
      ],
      blocks: [
        { type: "prose", body: "A replica can be sent the **statement** — the literal `UPDATE ... WHERE ...` — and re-execute it. Compact, and wrong the moment a statement is non-deterministic: `NOW()` evaluates differently on each node, `RANDOM()` obviously does, and anything depending on row order can diverge. Divergence is the worst kind of bug here, because nothing errors; the copies simply stop agreeing.\n\nOr it can be sent **the effects** — the actual before and after images of each changed row. Larger on the wire, and immune to all of that, because there is nothing left to re-evaluate. This is why row-based replication is the modern default despite costing more bandwidth." },
        { type: "prose", heading: "Catching up after a gap", body: "A replica that was offline, or is brand new, needs everything it missed. The standard route is a consistent snapshot plus the log position it was taken at, then replaying the log from that position until it converges on live traffic. The log has to be retained long enough for the slowest replica to get through it — if it is trimmed while a replica is still behind, that replica can never catch up and must be rebuilt from scratch." },
      ],
    },
    {
      phase: "high-level",
      title: "The replication path",
      summary: "Where the acknowledgement happens is the whole design.",
      concepts: [
        { slug: "repl-sync-async", name: "Synchronous vs. asynchronous acknowledgement", summary: "Acknowledge after a replica confirms and no acknowledged write is ever lost, but the writer waits for the slowest replica. Acknowledge immediately and writes are fast, with a window in which a leader failure loses them.", difficulty: 4, tags: ["replication", "consistency"] },
      ],
      blocks: [
        { type: "prose", body: "The one decision that defines the system: when do you tell the client the write succeeded?\n\n**Synchronously** — after at least one replica confirms it has the write. Nothing acknowledged is ever lost, because the data exists in two places before the client hears \"ok\". You have coupled write latency to your slowest replica, and if that replica is unreachable, writes stall.\n\n**Asynchronously** — as soon as the leader has it. Fast and unaffected by replica health, with a window: if the leader dies before the write ships, an acknowledged write is gone. \"Acknowledged and then lost\" is exactly the failure users experience as data corruption.\n\n**Semi-synchronous** is the common middle: wait for one replica, let the others follow. Bounded latency, no single-node loss." },
        { type: "diagram", diagram: {
          title: "Synchronous and asynchronous acknowledgement",
          columns: 5,
          rows: 3,
          nodes: [
            { id: "client", label: "Client", detail: "Cares about exactly one thing: once it sees success, is the write safe?", icon: "client", col: 0, row: 1 },
            { id: "leader", label: "Leader", sublabel: "takes all writes", detail: "The single writer. It decides when the client hears success, which is what makes this the whole design decision.", icon: "database", col: 1, row: 1, accent: "blue" },
            { id: "sync", label: "Sync replica", detail: "Must confirm before the client is told anything. Guarantees the write exists twice — and puts this replica's latency on every write.", icon: "replica", col: 3, row: 0, accent: "green" },
            { id: "async1", label: "Async replica", detail: "Receives the write whenever it can. Falls behind under load without slowing anyone down.", icon: "replica", col: 3, row: 2, accent: "slate" },
            { id: "ack", label: "Acknowledged", detail: "The moment the client believes the data is durable. Everything before it is design; everything after is hope.", icon: "generic", col: 4, row: 1, shape: "pill", accent: "green" },
          ],
          edges: [
            { id: "r1", from: "client", to: "leader", step: 1, label: "write" },
            { id: "r2", from: "leader", to: "sync", step: 2, label: "must confirm" },
            { id: "r3", from: "leader", to: "async1", step: 3, label: "fire and forget", style: "dashed" },
            { id: "r4", from: "sync", to: "ack", step: 4 },
            { id: "r5", from: "ack", to: "client", step: 5, label: "success", route: "vertical-first" },
          ],
          steps: [
            { index: 1, caption: "The client sends a write to the leader — the only node that accepts them.", nodeIds: ["client", "leader"], edgeIds: ["r1"] },
            { index: 2, caption: "The leader forwards it to the synchronous replica and waits.", nodeIds: ["leader", "sync"], edgeIds: ["r2"] },
            { index: 3, caption: "Asynchronous replicas are told too, but nobody waits for them.", nodeIds: ["leader", "async1"], edgeIds: ["r3"] },
            { index: 4, caption: "Once the sync replica confirms, the write exists in two places.", nodeIds: ["sync", "ack"], edgeIds: ["r4"] },
            { index: 5, caption: "Only now is the client told. Move this step earlier and writes get faster and less safe.", nodeIds: ["ack", "client"], edgeIds: ["r5"] },
          ],
        } },
        {
            type: "quiz",
            question: "You move the acknowledgement from after the sync replica confirms, to immediately when the leader has the write. What exactly did you trade?",
            options: [
              { id: "a", label: "Read capacity for write capacity" },
              { id: "b", label: "Write latency for the guarantee that an acknowledged write survives losing the leader" },
              { id: "c", label: "Storage cost for durability" },
              { id: "d", label: "Nothing meaningful — the replica still receives it" },
            ],
            correctOptionId: "b",
            explanation: "Writes get faster because nobody waits for a second machine. In exchange there is now a window where the client has been told 'ok' but the data exists in exactly one place — and if the leader dies inside that window, an acknowledged write is gone. That is precisely the failure users describe as data loss.",
          },
        ],
    },
    {
      phase: "deep-dive",
      title: "Reading your own writes",
      summary: "The anomaly users actually notice, and why it is not a bug in the database.",
      concepts: [
        { slug: "repl-read-your-writes", name: "Read-your-writes consistency", summary: "Write to the leader, read from a lagging replica, and your own change is missing. The fixes route a user's reads to the leader for a window, or pin them to a replica known to have caught up.", difficulty: 4, tags: ["consistency"] },
        { slug: "repl-monotonic", name: "Monotonic reads", summary: "Two reads hitting replicas at different lag positions can show a user time moving backwards — a comment appears, then vanishes. Pinning a session to one replica prevents it.", difficulty: 4, tags: ["consistency", "ordering"] },
      ],
      blocks: [
        { type: "prose", body: "A user edits their profile, the write goes to the leader, the page reloads, the read is served by a replica two seconds behind — and their change is not there. They will report this as data loss. Nothing is broken; asynchronous replication is doing precisely what it promised.\n\nThe fixes are all about routing rather than about the storage engine. **Read from the leader for a window** after a user writes — simple, and it concentrates load on the leader exactly when a user is most active. **Track the write's log position** in the session, and only use a replica that has reached it. More precise, and it needs the client or session to carry that position." },
        { type: "prose", heading: "The subtler one", body: "Monotonic reads: two consecutive reads land on replicas at different positions, the second one further behind, and the user watches a comment appear and then disappear. Time appears to run backwards. The standard remedy is to pin a session to one replica, so a given user sees a consistent — if slightly stale — view rather than an inconsistent fresh one." },
        { type: "callout", tone: "note", body: "Notice what all these fixes have in common: none of them make replication synchronous. They accept lag and manage which reader is exposed to it. That is usually the right instinct — the anomalies are about who reads where, not about the copies themselves." },
      ],
    },
    {
      phase: "bottlenecks",
      title: "Failover, and the writes it eats",
      summary: "Promoting a replica is the moment every deferred decision comes due at once.",
      concepts: [
        { slug: "repl-failover", name: "Leader failover and lost writes", summary: "Promoting an asynchronous replica discards whatever the old leader had acknowledged but not shipped. Choosing the most caught-up replica narrows the window; only synchronous replication closes it.", difficulty: 4, tags: ["availability", "replication"] },
        { slug: "repl-split-brain", name: "Split brain", summary: "If the old leader is alive but unreachable, it may keep accepting writes while a new one is promoted. Two leaders diverge, and merging them afterwards means choosing whose writes to discard.", difficulty: 5, tags: ["availability", "consistency"] },
      ],
      blocks: [
        { type: "prose", body: "The leader dies. A replica is promoted. Whatever the old leader had acknowledged but not yet shipped is now gone — writes the client was told had succeeded. Promoting the most caught-up replica narrows that window; nothing but synchronous replication closes it, which is the bill for the latency you saved earlier." },
        { type: "callout", tone: "pitfall", body: "Split brain is the failure that turns a bad hour into a bad week. The old leader is not dead, only unreachable, so it keeps accepting writes while the promoted node also accepts writes. Two divergent histories, both durable, both real. Reconciling them is not a technical exercise — it is deciding which customers' writes to throw away." },
        { type: "prose", heading: "Why consensus shows up here", body: "This is the point where systems reach for Raft or Paxos. The value is not the election itself but the guarantee that **at most one leader can exist at a time**, because a node must win a majority to lead and a partition cannot produce two majorities. That is why an odd node count matters: a five-node cluster tolerates two failures and can still form a majority, while a partition into two and three has exactly one side able to proceed." },
      ],
    },
  ],
};
