import type { QuizQuestion } from "../quizTypes";

export const chatSystemQuiz: QuizQuestion[] = [
  {
    id: "cs-1",
    phase: "requirements",
    question: "Why doesn't plain HTTP request/response fit chat delivery?",
    options: [
      { id: "a", label: "HTTP can't carry enough data per message" },
      { id: "b", label: "The server needs to push to a recipient who isn't asking" },
      { id: "c", label: "HTTP is too slow for text" },
      { id: "d", label: "HTTP can't authenticate per message" },
    ],
    correctOptionId: "b",
    explanation:
      "Bob's client can't know a message arrived without being told. Polling wastes enormous effort for the latency you want, which is what points at a persistent bidirectional connection.",
  },
  {
    id: "cs-2",
    phase: "estimation",
    question: "What dominates capacity planning for a chat system?",
    options: [
      { id: "a", label: "Requests per second" },
      { id: "b", label: "Concurrent long-lived connections" },
      { id: "c", label: "Total stored message bytes" },
      { id: "d", label: "Database write throughput" },
    ],
    correctOptionId: "b",
    explanation:
      "Unlike a stateless API sized by throughput, a chat server holds one open socket per online user for as long as they're online. 50 million concurrent connections is a fundamentally different capacity model than 50 million requests/sec.",
  },
  {
    id: "cs-3",
    phase: "high-level",
    question: "Why does a chat server need a connection registry when a stateless API doesn't?",
    options: [
      { id: "a", label: "To authenticate users before delivery" },
      { id: "b", label: "Because a socket lives on one specific server, so senders must find which one" },
      { id: "c", label: "To keep messages ordered within a conversation" },
      { id: "d", label: "To balance new connections evenly" },
    ],
    correctOptionId: "b",
    explanation:
      "Any stateless server can answer any request, but a live socket exists on exactly one machine. Routing a message means discovering which of hundreds of servers holds the recipient — a lookup a stateless design never needs.",
  },
  {
    id: "cs-4",
    phase: "deep-dive",
    question: "What does persisting before pushing buy you?",
    options: [
      { id: "a", label: "Lower delivery latency" },
      { id: "b", label: "Offline delivery and mid-flight crash recovery become the same code path" },
      { id: "c", label: "Stronger message ordering" },
      { id: "d", label: "Smaller storage footprint" },
    ],
    correctOptionId: "b",
    explanation:
      "Once the store is the source of truth, 'recipient was offline' and 'the server died mid-delivery' both resolve identically: fetch everything newer than your last message on reconnect. No separate offline queue to keep in sync.",
  },
  {
    id: "cs-5",
    phase: "bottlenecks",
    question: "Why do large group chats end up on a different code path from small ones?",
    options: [
      { id: "a", label: "Large groups need stronger encryption" },
      { id: "b", label: "Fanning one message to thousands of live sockets is a feed-scale problem, not a two-person one" },
      { id: "c", label: "Group messages can't be persisted" },
      { id: "d", label: "Small groups don't need a registry" },
    ],
    correctOptionId: "b",
    explanation:
      "Forwarding to two recipients is trivial; forwarding to 10,000 across hundreds of servers is the celebrity fan-out problem again. The same push-versus-pull trade-offs reappear, even though both look identical to the user.",
  },
];
