import type { QuizQuestion } from "../quizTypes";

export const distributedCacheQuiz: QuizQuestion[] = [
  {
    id: "dc-1",
    phase: "requirements",
    question: "When does a cache need to become a distributed system rather than a single node?",
    options: [
      { id: "a", label: "As soon as more than one application server exists" },
      { id: "b", label: "When the hot working set outgrows one machine's RAM, or its request rate saturates one machine" },
      { id: "c", label: "When entries need a TTL" },
      { id: "d", label: "When the cache must survive a restart" },
    ],
    correctOptionId: "b",
    explanation:
      "A single node is fine for a long time. What forces distribution is running out of a resource one machine has: memory for the working set, or network and CPU for the request rate. Everything hard about the design follows from splitting keys across nodes.",
  },
  {
    id: "dc-2",
    phase: "high-level",
    question: "You run 10 nodes with hash(key) % N routing and add an eleventh. Roughly what fraction of keys move?",
    options: [
      { id: "a", label: "About 1/11 — only the new node's share" },
      { id: "b", label: "About 10%, one node's worth" },
      { id: "c", label: "Nearly all of them" },
      { id: "d", label: "None; modulo hashing is stable" },
    ],
    correctOptionId: "c",
    explanation:
      "Changing N changes the modulo result for almost every key, so the cache effectively empties itself at the exact moment you add capacity — a stampede of misses straight through to the origin. Consistent hashing moves only the ~1/N of keys the new node takes over.",
  },
  {
    id: "dc-3",
    phase: "high-level",
    question: "What problem do virtual nodes solve on a consistent hashing ring?",
    options: [
      { id: "a", label: "They let a key belong to more than one node" },
      { id: "b", label: "They even out the uneven key shares you get from placing few nodes randomly" },
      { id: "c", label: "They reduce the memory each node needs" },
      { id: "d", label: "They make the hash function faster" },
    ],
    correctOptionId: "b",
    explanation:
      "With a handful of nodes placed at random points, one can land on a large arc and own far more than its share. Giving each physical node many positions averages those arcs out, so the distribution tightens toward even as virtual node count rises.",
  },
  {
    id: "dc-4",
    phase: "deep-dive",
    question: "Why is replication nearly free to add once keys live on a ring?",
    options: [
      { id: "a", label: "The ring stores every key on every node already" },
      { id: "b", label: "Ring order deterministically defines the next R nodes, so no replica-placement service is needed" },
      { id: "c", label: "Replicas can be computed from the key's hash without any node list" },
      { id: "d", label: "Consistent hashing removes the need for replication" },
    ],
    correctOptionId: "b",
    explanation:
      "The ring already gives a total ordering of nodes for any key. Storing at the first R nodes clockwise means every client can compute the same replica set independently — no coordination, no lookup service, and failover is just moving to the next one.",
  },
  {
    id: "dc-5",
    phase: "bottlenecks",
    question: "A single viral key overwhelms the node that owns it. Why doesn't better hashing fix this?",
    options: [
      { id: "a", label: "Hashing spreads keys evenly, but all traffic to one key still lands on one node" },
      { id: "b", label: "The hash function is biased toward popular keys" },
      { id: "c", label: "Virtual nodes stop working above a traffic threshold" },
      { id: "d", label: "It does fix it, given enough virtual nodes" },
    ],
    correctOptionId: "a",
    explanation:
      "Consistent hashing balances key count, not key popularity, and a single key has exactly one owner. The fixes are application-level: replicate that specific key far more widely than the default factor, or cache it closer to the client so most requests never reach the ring.",
  },
];
