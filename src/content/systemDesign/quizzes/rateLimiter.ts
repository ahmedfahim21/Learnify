import type { QuizQuestion } from "../quizTypes";

export const rateLimiterQuiz: QuizQuestion[] = [
  {
    id: "rl-1",
    phase: "requirements",
    question: "What is a rate limiter fundamentally protecting?",
    options: [
      { id: "a", label: "The fairness of usage between customers" },
      { id: "b", label: "A specific downstream resource from overload" },
      { id: "c", label: "The API's public reputation" },
      { id: "d", label: "The accuracy of usage billing" },
    ],
    correctOptionId: "b",
    explanation:
      "Fairness and billing are side effects. The limiter exists because something downstream — a database, a paid third-party API, your own compute — falls over past a certain rate, and one client shouldn't be able to take it there.",
  },
  {
    id: "rl-2",
    phase: "estimation",
    question: "Why do rate limiters almost always keep their counters in an in-memory store like Redis?",
    options: [
      { id: "a", label: "Redis is the only store with atomic increments" },
      { id: "b", label: "It runs on every request, so millisecond-scale reads would dominate total latency" },
      { id: "c", label: "Counters are too large for a relational database" },
      { id: "d", label: "Redis persists counters more reliably" },
    ],
    correctOptionId: "b",
    explanation:
      "The limiter executes as often as the API itself. At 50,000 requests/sec, a 5ms check would add 250 seconds of aggregate latency per wall-clock second. Sub-millisecond reads plus atomic increment are what make the check disappear into the noise.",
  },
  {
    id: "rl-3",
    phase: "high-level",
    question: "Four API servers each keep an in-process counter for a 100 req/min limit. What does a client actually get?",
    options: [
      { id: "a", label: "100 req/min — the load balancer keeps them consistent" },
      { id: "b", label: "25 req/min, the limit split across servers" },
      { id: "c", label: "Up to 400 req/min by spreading requests across all four" },
      { id: "d", label: "It depends on the algorithm each server uses" },
    ],
    correctOptionId: "c",
    explanation:
      "Each server independently allows its own 100, so the effective limit multiplies by the fleet size. This is why the counter has to live in a store every server shares — and why increment-and-compare has to be atomic there.",
  },
  {
    id: "rl-4",
    phase: "deep-dive",
    question: "What does a fixed-window limiter get wrong at the window boundary?",
    options: [
      { id: "a", label: "It rejects legitimate traffic at the start of each window" },
      { id: "b", label: "It allows up to double the limit across two adjacent windows" },
      { id: "c", label: "It loses count when the window resets" },
      { id: "d", label: "It cannot express a per-second limit" },
    ],
    correctOptionId: "b",
    explanation:
      "A client can spend its full allowance in the last second of one window and again in the first second of the next — twice the intended rate over a two-second span. Sliding windows and token buckets both avoid this, at the cost of more state per client.",
  },
  {
    id: "rl-5",
    phase: "bottlenecks",
    question: "The counter store becomes unreachable. Should the limiter fail open or closed?",
    options: [
      { id: "a", label: "Closed — an unprotected API is the greater risk" },
      { id: "b", label: "Open — a limiter outage shouldn't become a total API outage" },
      { id: "c", label: "Closed, but only for unauthenticated clients" },
      { id: "d", label: "Neither; the request should hang until the store recovers" },
    ],
    correctOptionId: "b",
    explanation:
      "Failing closed converts a dependency blip into a full outage for every caller. A brief window of unlimited traffic is almost always the smaller risk — and hanging is the worst option, since it ties up connections and spreads the failure upstream.",
  },
];
