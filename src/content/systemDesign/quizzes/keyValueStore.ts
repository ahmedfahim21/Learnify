import type { QuizQuestion } from "../quizTypes";

export const keyValueStoreQuiz: QuizQuestion[] = [
  {
    id: "kv-1",
    phase: "requirements",
    question: "What does giving up joins and ad-hoc queries actually buy a key-value store?",
    options: [
      { id: "a", label: "Lower storage cost per row" },
      { id: "b", label: "Every operation addresses one key, so any key can live on any machine" },
      { id: "c", label: "Stronger consistency guarantees" },
      { id: "d", label: "Faster writes to a single node" },
    ],
    correctOptionId: "b",
    explanation:
      "A relational query might need rows from many partitions, which is what makes sharding it hard. Restricting every operation to a single key means the system always knows exactly which machine to ask — that constraint is the whole reason horizontal scale is tractable.",
  },
  {
    id: "kv-2",
    phase: "high-level",
    question: "With N=3 replicas, which quorum setting guarantees a read sees the latest acknowledged write?",
    options: [
      { id: "a", label: "W=1, R=1 — fastest on both paths" },
      { id: "b", label: "W=2, R=2, because W + R > N" },
      { id: "c", label: "W=3, R=3, the only safe option" },
      { id: "d", label: "Any setting, provided writes go through one leader" },
    ],
    correctOptionId: "b",
    explanation:
      "W + R > N forces the write set and read set to overlap on at least one replica, so a read always touches a node holding the newest version. W=3/R=3 also overlaps but gives up all availability — any single node being down blocks every operation.",
  },
  {
    id: "kv-3",
    phase: "high-level",
    question: "In a quorum write with N=3 and W=2, what happens to the third replica if it's slow?",
    options: [
      { id: "a", label: "The write fails and is rolled back" },
      { id: "b", label: "The write succeeds; that replica catches up later via repair" },
      { id: "c", label: "The coordinator blocks until it responds" },
      { id: "d", label: "The key becomes unavailable until it recovers" },
    ],
    correctOptionId: "b",
    explanation:
      "The coordinator confirms as soon as W replicas acknowledge and doesn't wait on the rest. The laggard reconciles afterwards through hinted handoff or read repair — tolerating that gap is exactly the availability the quorum model is buying.",
  },
  {
    id: "kv-4",
    phase: "deep-dive",
    question: "What can a vector clock tell you that a plain timestamp cannot?",
    options: [
      { id: "a", label: "Which write was physically first" },
      { id: "b", label: "Whether two writes were genuinely concurrent or one strictly followed the other" },
      { id: "c", label: "How many replicas hold a version" },
      { id: "d", label: "Whether a write has been durably persisted" },
    ],
    correctOptionId: "b",
    explanation:
      "A wall-clock timestamp can't distinguish real concurrency from clock skew. If one vector dominates another in every position, that version genuinely happened after; if neither dominates, the writes conflict and something has to reconcile them.",
  },
  {
    id: "kv-5",
    phase: "bottlenecks",
    question: "Under a network partition, what does the quorum model actually give you?",
    options: [
      { id: "a", label: "A way to avoid the CAP trade-off entirely" },
      { id: "b", label: "A per-request tuning knob for where you sit between consistency and availability" },
      { id: "c", label: "Guaranteed consistency regardless of partition" },
      { id: "d", label: "Automatic partition healing" },
    ],
    correctOptionId: "b",
    explanation:
      "CAP still applies — you can't have both during a partition. What N, W and R give you is the ability to choose per workload, and even per key: W=1/R=N favours write availability, W=N/R=1 favours read availability, and both above N/2 favours consistency.",
  },
];
