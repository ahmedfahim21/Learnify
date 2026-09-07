import type { QuizQuestion } from "../quizTypes";

export const webCrawlerQuiz: QuizQuestion[] = [
  {
    id: "wc-1",
    phase: "requirements",
    question: "Which constraint shapes most of a crawler's design?",
    options: [
      { id: "a", label: "Politeness — never overwhelming any single site" },
      { id: "b", label: "Parsing malformed HTML correctly" },
      { id: "c", label: "Compressing stored pages efficiently" },
      { id: "d", label: "Supporting every character encoding" },
    ],
    correctOptionId: "a",
    explanation:
      "Raw throughput is comparatively easy — add fetchers. The bound that shapes the architecture is that you must not hammer any one host, which is why the frontier is partitioned by host and why per-host delay state has to live with those URLs.",
  },
  {
    id: "wc-2",
    phase: "data-model",
    question: "A Bloom filter reports a URL as seen when it hasn't been. What is the consequence?",
    options: [
      { id: "a", label: "The page is fetched twice, wasting bandwidth" },
      { id: "b", label: "The page is never fetched and is silently missed" },
      { id: "c", label: "The frontier queue is corrupted" },
      { id: "d", label: "Nothing; false positives are impossible" },
    ],
    correctOptionId: "b",
    explanation:
      "A Bloom filter can return a false positive but never a false negative, so the failure mode is skipping a page you never actually fetched. At web scale that's an acceptable trade for the memory an exact set of billions of URLs would need.",
  },
  {
    id: "wc-3",
    phase: "high-level",
    question: "Why partition the URL frontier by host rather than randomly?",
    options: [
      { id: "a", label: "It compresses better" },
      { id: "b", label: "One shard then owns a host's URLs, so its politeness delay is purely local state" },
      { id: "c", label: "Hosts have similar page counts, so shards stay balanced" },
      { id: "d", label: "It lets URLs be deduplicated within a shard" },
    ],
    correctOptionId: "b",
    explanation:
      "Answering \"have we hit example.com too recently?\" needs no cross-shard coordination if every URL for that host lives on the same shard. Random partitioning would force a distributed check before every single fetch.",
  },
  {
    id: "wc-4",
    phase: "deep-dive",
    question: "What makes a calendar page with an endless 'next month' link dangerous?",
    options: [
      { id: "a", label: "It generates an infinite space of valid URLs that can trap a crawler on one host" },
      { id: "b", label: "It returns malformed HTML" },
      { id: "c", label: "It blocks crawlers via robots.txt" },
      { id: "d", label: "It redirects in a loop" },
    ],
    correctOptionId: "a",
    explanation:
      "Every generated page is genuinely valid and genuinely new, so nothing in the seen-set stops it. The defences are URL normalisation, so equivalent pages collapse to one entry, plus a hard cap on crawl depth or pages per host as a backstop.",
  },
  {
    id: "wc-5",
    phase: "bottlenecks",
    question: "Both the frontier and the seen-set outgrow one machine. What changes?",
    options: [
      { id: "a", label: "They move to disk on the same machine" },
      { id: "b", label: "Both shard across machines — the frontier by host, the seen-set by normalised URL" },
      { id: "c", label: "The seen-set is dropped and duplicates are tolerated" },
      { id: "d", label: "The crawl is split into independent runs that never share state" },
    ],
    correctOptionId: "b",
    explanation:
      "Both become distributed structures, but on different keys for different reasons: the frontier shards by host so politeness stays local, while the seen-set shards by a hash of the normalised URL because its only job is membership lookup.",
  },
];
