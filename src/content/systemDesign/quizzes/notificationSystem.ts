import type { QuizQuestion } from "../quizTypes";

export const notificationSystemQuiz: QuizQuestion[] = [
  {
    id: "ns-1",
    phase: "requirements",
    question: "What makes notifications harder than 'call three APIs'?",
    options: [
      { id: "a", label: "Message templates are hard to render" },
      { id: "b", label: "Each channel has its own provider, rate limit, latency and failure mode" },
      { id: "c", label: "Users change their contact details often" },
      { id: "d", label: "Notifications must arrive in a strict order" },
    ],
    correctOptionId: "b",
    explanation:
      "Push, email and SMS are three unreliable third parties with nothing in common. The design problem is decoupling 'an event happened' from three independent, differently-broken delivery paths.",
  },
  {
    id: "ns-2",
    phase: "estimation",
    question: "A breaking-news push targets 10 million subscribers against a 5,000/sec provider limit. What does that mean?",
    options: [
      { id: "a", label: "It arrives instantly; fan-out is parallel" },
      { id: "b", label: "It's a queued drain taking over half an hour, not a broadcast" },
      { id: "c", label: "The provider will reject the whole batch" },
      { id: "d", label: "The event must be split across several days" },
    ],
    correctOptionId: "b",
    explanation:
      "10 million sends at 5,000/sec is around 33 minutes. Surfacing that early matters, because 'instant' breaking-news push at this scale is really a rate-limited drain — and no amount of internal scaling changes the provider's ceiling.",
  },
  {
    id: "ns-3",
    phase: "high-level",
    question: "Why fan an event into per-channel queues rather than one shared queue?",
    options: [
      { id: "a", label: "Three queues are faster than one" },
      { id: "b", label: "So a stalled provider only blocks its own channel" },
      { id: "c", label: "Because each channel needs a different message format" },
      { id: "d", label: "To keep ordering consistent across channels" },
    ],
    correctOptionId: "b",
    explanation:
      "A shared queue means a backed-up SMS gateway delays every push behind it — classic head-of-line blocking. Separate queues let each channel drain, retry and fail on its own terms.",
  },
  {
    id: "ns-4",
    phase: "deep-dive",
    question: "A worker crashes after calling the provider but before acknowledging the queue. What prevents a double send?",
    options: [
      { id: "a", label: "An idempotency key derived from the event, checked by the provider or the delivery log" },
      { id: "b", label: "Exactly-once delivery from the queue" },
      { id: "c", label: "A lock held for the duration of the send" },
      { id: "d", label: "Nothing; duplicates are unavoidable" },
    ],
    correctOptionId: "a",
    explanation:
      "Queues generally guarantee at-least-once, so redelivery after a crash is expected. A deterministic key — event id plus channel plus recipient — makes the retry a safe no-op rather than a second notification.",
  },
  {
    id: "ns-5",
    phase: "bottlenecks",
    question: "Adding more workers stops making delivery faster. Why?",
    options: [
      { id: "a", label: "The queue becomes the bottleneck" },
      { id: "b", label: "The provider's rate limit is a hard external ceiling" },
      { id: "c", label: "Workers contend on the preferences table" },
      { id: "d", label: "Template rendering saturates CPU" },
    ],
    correctOptionId: "b",
    explanation:
      "Past the provider's limit, extra workers just collect 429s. The worker pool needs its own outbound rate limiter tuned to the provider's documented ceiling — the same token bucket idea, applied to your own traffic.",
  },
];
