import type { QuizQuestion } from "../quizTypes";

export const searchAutocompleteQuiz: QuizQuestion[] = [
  {
    id: "sa-1",
    phase: "requirements",
    question: "Why is autocomplete's latency budget tighter than almost anything else here?",
    options: [
      { id: "a", label: "Suggestions are expensive to compute" },
      { id: "b", label: "It fires on every keystroke, so a late suggestion arrives after the user has moved on" },
      { id: "c", label: "Search engines penalise slow endpoints" },
      { id: "d", label: "Users abandon slow pages" },
    ],
    correctOptionId: "b",
    explanation:
      "A suggestion that lands after the next character is typed is worse than useless — it flickers. That ~100ms round trip rules out live database queries and is why the trie is served from memory.",
  },
  {
    id: "sa-2",
    phase: "estimation",
    question: "10,000 searches/sec with an 8-character average query produces roughly what request rate?",
    options: [
      { id: "a", label: "About 10,000/sec — one per search" },
      { id: "b", label: "About 80,000/sec — one per keystroke" },
      { id: "c", label: "About 1,250/sec" },
      { id: "d", label: "It depends entirely on cache hit ratio" },
    ],
    correctOptionId: "b",
    explanation:
      "Firing per keystroke multiplies search volume by query length, so autocomplete is an order of magnitude higher-QPS than the search it feeds — even with modest user counts.",
  },
  {
    id: "sa-3",
    phase: "data-model",
    question: "Why cache a top-K list on every trie node instead of computing it per query?",
    options: [
      { id: "a", label: "It reduces the trie's memory footprint" },
      { id: "b", label: "Walking the subtree under a short prefix is expensive and grows with the dataset" },
      { id: "c", label: "Because query popularity never changes" },
      { id: "d", label: "It lets the database sort results" },
    ],
    correctOptionId: "b",
    explanation:
      "A prefix like 'a' sits above an enormous subtree. Precomputing each node's top-K makes a lookup cost the length of what was typed plus one read — bounded by the prefix, not by how much data you have.",
  },
  {
    id: "sa-4",
    phase: "high-level",
    question: "Why is the trie rebuilt by a batch job rather than updated on every search?",
    options: [
      { id: "a", label: "Updating live would make every read also a write, with lock contention on the hot path" },
      { id: "b", label: "Search logs aren't available in real time" },
      { id: "c", label: "Tries can't be modified after construction" },
      { id: "d", label: "Batch rebuilds produce smaller tries" },
    ],
    correctOptionId: "a",
    explanation:
      "Serving from an immutable snapshot means no locking, no coordination with writers, and no write amplification on a path that runs per keystroke. Freshness is traded away deliberately — and bought back separately.",
  },
  {
    id: "sa-5",
    phase: "deep-dive",
    question: "How do genuinely trending queries surface before the next rebuild?",
    options: [
      { id: "a", label: "The rebuild interval is shortened globally" },
      { id: "b", label: "A small, frequently-updated structure tracks spiking queries and is merged in at read time" },
      { id: "c", label: "Trending queries bypass the trie entirely" },
      { id: "d", label: "They can't; staleness is accepted" },
    ],
    correctOptionId: "b",
    explanation:
      "Rebuilding the whole trie in real time would give up everything the snapshot design bought. A tiny hot-path overlay tracking volume spikes handles 'what's happening now', while the batch trie keeps doing accurate long-run popularity.",
  },
];
