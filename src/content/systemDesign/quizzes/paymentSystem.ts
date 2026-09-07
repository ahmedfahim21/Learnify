import type { QuizQuestion } from "../quizTypes";

export const paymentSystemQuiz: QuizQuestion[] = [
  {
    id: "pay-1",
    phase: "requirements",
    question: "How does a payment system's priority ordering differ from the rest of this curriculum?",
    options: [
      { id: "a", label: "Throughput matters more than anything else" },
      { id: "b", label: "Correctness outranks latency and availability, not the other way round" },
      { id: "c", label: "Storage cost is the binding constraint" },
      { id: "d", label: "It has no meaningful read path" },
    ],
    correctOptionId: "b",
    explanation:
      "Elsewhere, eventual consistency in exchange for speed is a reasonable trade. Here a double charge or a silently dropped payment is a trust and often regulatory failure — two extra seconds is merely an annoyance.",
  },
  {
    id: "pay-2",
    phase: "api",
    question: "A charge times out and the client retries with the same idempotency key. What should happen?",
    options: [
      { id: "a", label: "A second charge is created and refunded later" },
      { id: "b", label: "The server returns the original charge's outcome without moving money again" },
      { id: "c", label: "The request is rejected as a duplicate" },
      { id: "d", label: "It retries only if the first definitely failed" },
    ],
    correctOptionId: "b",
    explanation:
      "The key was recorded against the original outcome, so the retry replays that result. Rejecting outright would be safe but useless — the client still wouldn't know what happened, which is the exact ambiguity the key resolves.",
  },
  {
    id: "pay-3",
    phase: "data-model",
    question: "Why is a balance computed from ledger entries rather than stored as a mutable field?",
    options: [
      { id: "a", label: "It uses less storage" },
      { id: "b", label: "A stored balance can silently drift from the transaction history; a derived one cannot" },
      { id: "c", label: "Databases can't update numeric fields atomically" },
      { id: "d", label: "It makes reads faster" },
    ],
    correctOptionId: "b",
    explanation:
      "Double-entry, append-only records mean there is no second number to fall out of sync. A bug can produce a wrong entry, which is visible and auditable, but it can't decouple a balance from the history that's supposed to explain it.",
  },
  {
    id: "pay-4",
    phase: "high-level",
    question: "Why persist a payment's state before calling the external processor?",
    options: [
      { id: "a", label: "To reserve the idempotency key" },
      { id: "b", label: "So a crash mid-call leaves a recoverable record rather than an unknown" },
      { id: "c", label: "Because processors require a reference id" },
      { id: "d", label: "To make the call faster" },
    ],
    correctOptionId: "b",
    explanation:
      "The dangerous state is 'sent, outcome unknown'. Writing it down first means recovery can find the payment sitting in processing and resolve it deliberately, instead of there being no evidence the attempt ever happened.",
  },
  {
    id: "pay-5",
    phase: "bottlenecks",
    question: "Why run reconciliation against the processor's records if the design is already careful?",
    options: [
      { id: "a", label: "Regulators require a daily export" },
      { id: "b", label: "Bugs and edge cases still happen, and finding a discrepancy nightly beats hearing it from a customer weeks later" },
      { id: "c", label: "The processor's records are authoritative for balances" },
      { id: "d", label: "It's the only way to detect refunds" },
    ],
    correctOptionId: "b",
    explanation:
      "Reconciliation is the backstop for everything the design didn't anticipate. Diffing your ledger against the processor's own record surfaces drift automatically, rather than letting it surface as a support ticket about a missing charge.",
  },
];
