import type { QuizQuestion } from "../quizTypes";

export const newsFeedQuiz: QuizQuestion[] = [
  {
    id: "nf-1",
    phase: "requirements",
    question: "Why does feed design push work toward publish time rather than read time?",
    options: [
      { id: "a", label: "Writes are easier to scale than reads" },
      { id: "b", label: "Reads happen far more often, so precomputing keeps the common path cheap" },
      { id: "c", label: "Posts must be validated before storage" },
      { id: "d", label: "Read-time work can't be cached" },
    ],
    correctOptionId: "b",
    explanation:
      "Every app open is a read; posting is comparatively rare. Doing the expensive assembly once at publish time, so each of many reads is a cheap list fetch, is the trade that makes feeds fast.",
  },
  {
    id: "nf-2",
    phase: "estimation",
    question: "Which number breaks a pure fan-out-on-write design?",
    options: [
      { id: "a", label: "Average followers per user" },
      { id: "b", label: "Maximum followers — the celebrity case" },
      { id: "c", label: "Total posts per day" },
      { id: "d", label: "Average post size" },
    ],
    correctOptionId: "b",
    explanation:
      "Designing for a 200-follower average looks fine until one account with 100 million followers posts and generates 100 million cache writes from a single request. The outlier, not the average, decides the architecture.",
  },
  {
    id: "nf-3",
    phase: "high-level",
    question: "What does the hybrid fan-out strategy actually do?",
    options: [
      { id: "a", label: "Push for accounts under a follower threshold, pull at read time for those above it" },
      { id: "b", label: "Push to active users and pull for inactive ones" },
      { id: "c", label: "Push text and pull images" },
      { id: "d", label: "Push during off-peak hours and pull at peak" },
    ],
    correctOptionId: "a",
    explanation:
      "Ordinary accounts get precomputed feeds so reads stay instant, while high-follower accounts skip fan-out entirely and are merged in at read time — so one viral post never triggers a hundred-million-write storm.",
  },
  {
    id: "nf-4",
    phase: "deep-dive",
    question: "Why keep ranking separate from fan-out?",
    options: [
      { id: "a", label: "Ranking needs a different database" },
      { id: "b", label: "So the model can be retrained and shipped without touching delivery" },
      { id: "c", label: "Because ranking must run before fan-out" },
      { id: "d", label: "Fan-out cannot preserve any ordering" },
    ],
    correctOptionId: "b",
    explanation:
      "Fan-out answers 'which posts are candidates'; ranking answers 'in what order'. Keeping them separate means iterating on scoring doesn't touch the delivery path that everything else depends on.",
  },
  {
    id: "nf-5",
    phase: "bottlenecks",
    question: "An account grows past the fan-out threshold. Why can't you just flip a switch?",
    options: [
      { id: "a", label: "Followers already hold cached entries, so the transition has to be gradual" },
      { id: "b", label: "The threshold is stored immutably" },
      { id: "c", label: "Follower counts can't be measured in real time" },
      { id: "d", label: "You can — it's an atomic change" },
    ],
    correctOptionId: "a",
    explanation:
      "Existing cached posts don't disappear, and deleting them would be its own write storm. In practice new fan-out writes simply stop, old entries age out naturally, and the read-time merge picks up that account's new posts going forward.",
  },
];
