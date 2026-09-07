import type { QuizQuestion } from "../quizTypes";

export const distributedMessageQueueQuiz: QuizQuestion[] = [
  {
    id: "mq-1",
    phase: "requirements",
    question: "What does putting a queue between a producer and its consumers actually buy?",
    options: [
      { id: "a", label: "Guaranteed message ordering across the whole system" },
      { id: "b", label: "The producer stops being as slow, and as fragile, as its slowest consumer" },
      { id: "c", label: "Lower total latency end to end" },
      { id: "d", label: "Automatic retries of failed business logic" },
    ],
    correctOptionId: "b",
    explanation:
      "Calling consumers directly couples their availability and throughput to the producer's. A queue lets each side scale, deploy and fail independently — the producer just appends and moves on.",
  },
  {
    id: "mq-2",
    phase: "data-model",
    question: "Why is an append-only log so much faster than a general-purpose database here?",
    options: [
      { id: "a", label: "It keeps everything in memory" },
      { id: "b", label: "Sequential disk writes are dramatically faster than random ones, and nothing is ever updated in place" },
      { id: "c", label: "It skips durability guarantees" },
      { id: "d", label: "Messages are compressed automatically" },
    ],
    correctOptionId: "b",
    explanation:
      "New messages always go at the end and are never modified. That structural simplicity — sequential writes, no update path, no index maintenance — is most of why this design sustains such high throughput.",
  },
  {
    id: "mq-3",
    phase: "api",
    question: "Why do consumers track their own offsets instead of the broker marking messages consumed?",
    options: [
      { id: "a", label: "It reduces broker storage" },
      { id: "b", label: "It lets independent consumers read the same topic at their own pace, and replay by rewinding" },
      { id: "c", label: "It guarantees exactly-once delivery" },
      { id: "d", label: "Brokers cannot write while serving reads" },
    ],
    correctOptionId: "b",
    explanation:
      "Because the broker doesn't delete on read or track per-consumer state, several consumer groups can read the same log independently — and replaying is just resetting your own offset backwards.",
  },
  {
    id: "mq-4",
    phase: "deep-dive",
    question: "You need every event for a given user processed in order. What does that require?",
    options: [
      { id: "a", label: "A single partition for the entire topic" },
      { id: "b", label: "A partition key that routes that user's events to the same partition" },
      { id: "c", label: "Exactly one consumer in the group" },
      { id: "d", label: "Nothing; global ordering is guaranteed" },
    ],
    correctOptionId: "b",
    explanation:
      "Ordering holds within a partition and nowhere else. Hashing on user id keeps that user's events in one log while other users still spread across partitions — a single partition would work too, and would throw away all the parallelism.",
  },
  {
    id: "mq-5",
    phase: "bottlenecks",
    question: "What stops a broker failure from losing an acknowledged message?",
    options: [
      { id: "a", label: "Each partition is replicated, with a leader and in-sync followers ready to take over" },
      { id: "b", label: "Producers retry until a different broker accepts" },
      { id: "c", label: "Consumers re-request anything missing" },
      { id: "d", label: "Messages are held in memory until fully consumed" },
    ],
    correctOptionId: "a",
    explanation:
      "A partition on one broker would be a single point of failure. Replicating it across several, with one elected leader handling traffic, means a failure promotes a follower rather than losing the log.",
  },
];
