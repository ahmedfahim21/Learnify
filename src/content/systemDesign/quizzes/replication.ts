import type { QuizQuestion } from "../quizTypes";

export const replicationQuiz: QuizQuestion[] = [
  {
    id: "rp-1", phase: "requirements",
    question: "Why is a replica not a substitute for a backup?",
    options: [
      { id: "a", label: "Replicas store less data than backups" },
      { id: "b", label: "A replica copies the present faithfully, including your mistakes" },
      { id: "c", label: "Replicas cannot be restored from" },
      { id: "d", label: "Backups are more durable per copy" },
    ],
    correctOptionId: "b",
    explanation: "A DELETE without a WHERE clause replicates in milliseconds. A backup is a copy of the past you can return to; a replica is a mirror of the present, mistakes included.",
  },
  {
    id: "rp-2", phase: "estimation",
    question: "Your workload is write-bound. What do more replicas give you?",
    options: [
      { id: "a", label: "Proportionally more write throughput" },
      { id: "b", label: "Nothing for writes — replicas add read capacity and durability only" },
      { id: "c", label: "Lower write latency" },
      { id: "d", label: "Reduced storage cost" },
    ],
    correctOptionId: "b",
    explanation: "Every replica performs every write, so a replication factor of 3 means three times the write work and three times the storage. Write-bound systems need partitioning, not copies.",
  },
  {
    id: "rp-3", phase: "api",
    question: "What problem does multi-leader replication introduce that single-leader does not have?",
    options: [
      { id: "a", label: "Replication lag" },
      { id: "b", label: "Write conflicts between concurrent writers" },
      { id: "c", label: "The need for health checks" },
      { id: "d", label: "Storage amplification" },
    ],
    correctOptionId: "b",
    explanation: "One writer means one ordering and no conflicts by construction. Several writers can modify the same row simultaneously, and something then has to decide what that means — you have traded a throughput bottleneck for a correctness problem.",
  },
  {
    id: "rp-4", phase: "data-model",
    question: "Why is statement-based replication risky?",
    options: [
      { id: "a", label: "It uses more bandwidth than row-based" },
      { id: "b", label: "Non-deterministic statements evaluate differently on each node, so copies silently diverge" },
      { id: "c", label: "It cannot replicate DELETEs" },
      { id: "d", label: "It requires the replica to be idle" },
    ],
    correctOptionId: "b",
    explanation: "NOW(), RANDOM() and anything order-dependent produce different results on each node. Nothing errors — the copies just stop agreeing, which is the worst failure mode available. Row-based ships the resulting changes, so there is nothing left to re-evaluate.",
  },
  {
    id: "rp-5", phase: "data-model",
    question: "A replica has been offline long enough that the leader trimmed its log past the replica's position. What now?",
    options: [
      { id: "a", label: "It replays from the earliest retained entry" },
      { id: "b", label: "It can never catch up and must be rebuilt from a snapshot" },
      { id: "c", label: "The leader regenerates the missing entries" },
      { id: "d", label: "It promotes itself to leader" },
    ],
    correctOptionId: "b",
    explanation: "The log is the only record of what it missed. Once that window is gone the replica has an unbridgeable gap and needs a fresh snapshot — which is why retention has to outlast your slowest replica's worst outage.",
  },
  {
    id: "rp-6", phase: "high-level",
    question: "What exactly do you give up by acknowledging writes asynchronously?",
    options: [
      { id: "a", label: "Read throughput" },
      { id: "b", label: "The guarantee that an acknowledged write survives the leader failing" },
      { id: "c", label: "The ability to add replicas later" },
      { id: "d", label: "Ordering of writes" },
    ],
    correctOptionId: "b",
    explanation: "The client is told \"ok\" before the data exists anywhere else. If the leader dies in that window the write is gone despite having been acknowledged — which users experience as data loss, because that is what it is.",
  },
  {
    id: "rp-7", phase: "deep-dive",
    question: "A user saves their profile, the page reloads, and their change is missing. What happened?",
    options: [
      { id: "a", label: "The write was rejected silently" },
      { id: "b", label: "The read was served by a replica that has not applied the write yet" },
      { id: "c", label: "The leader failed over mid-request" },
      { id: "d", label: "Their session expired" },
    ],
    correctOptionId: "b",
    explanation: "Classic read-your-writes violation. Nothing is broken — asynchronous replication is doing what it promised. The fixes route that user's reads to the leader briefly, or to a replica known to have reached their write's log position.",
  },
  {
    id: "rp-8", phase: "deep-dive",
    question: "A user refreshes twice and a comment appears, then vanishes. Which guarantee is missing?",
    options: [
      { id: "a", label: "Read-your-writes" },
      { id: "b", label: "Monotonic reads" },
      { id: "c", label: "Linearizability" },
      { id: "d", label: "Durability" },
    ],
    correctOptionId: "b",
    explanation: "Consecutive reads landed on replicas at different lag positions, the second further behind, so time appeared to run backwards. Pinning a session to one replica gives a consistent — if slightly stale — view instead of an inconsistent fresh one.",
  },
  {
    id: "rp-9", phase: "bottlenecks",
    question: "Why do consensus protocols use an odd number of nodes?",
    options: [
      { id: "a", label: "Odd numbers replicate faster" },
      { id: "b", label: "A partition can never produce two majorities, so at most one leader can exist" },
      { id: "c", label: "It halves storage cost" },
      { id: "d", label: "Even clusters cannot elect at all" },
    ],
    correctOptionId: "b",
    explanation: "Leadership requires winning a majority, and only one side of any partition can hold one. That is the actual guarantee being bought — not the election mechanics, but the impossibility of two leaders accepting divergent writes.",
  },
  {
    id: "rp-10", phase: "bottlenecks",
    question: "The old leader is alive but unreachable while a replica is promoted. Why is this the worst case?",
    options: [
      { id: "a", label: "Failover takes longer than usual" },
      { id: "b", label: "Both accept writes, producing two real histories that must be reconciled by discarding someone's data" },
      { id: "c", label: "The new leader starts empty" },
      { id: "d", label: "Replicas stop accepting reads" },
    ],
    correctOptionId: "b",
    explanation: "Split brain. Both sides are durable and both are genuine, so merging them is not a technical exercise — it is deciding which customers' acknowledged writes to throw away.",
  },
];
