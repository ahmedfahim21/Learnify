import type { QuizQuestion } from "../quizTypes";

export const urlShortenerQuiz: QuizQuestion[] = [
  {
    id: "us-1",
    phase: "requirements",
    question: "Which fact about a URL shortener should drive the most architectural decisions?",
    options: [
      { id: "a", label: "Short codes must be human-readable" },
      { id: "b", label: "Reads outnumber writes by roughly 100 to 1" },
      { id: "c", label: "Links have to expire eventually" },
      { id: "d", label: "The long URL can be arbitrarily long" },
    ],
    correctOptionId: "b",
    explanation:
      "A link is created once and clicked many times. That asymmetry is why the design is read-optimised and cache-friendly — it justifies the cache, the sharding key, and keeping everything but a lookup off the redirect path.",
  },
  {
    id: "us-2",
    phase: "estimation",
    question: "Seven base62 characters give about 3.5 trillion codes. Why pick seven rather than five?",
    options: [
      { id: "a", label: "Five characters would be too short to read aloud" },
      { id: "b", label: "Five gives about 916 million codes — exhausted well inside the 10-year volume" },
      { id: "c", label: "Seven compresses better in the database index" },
      { id: "d", label: "Base62 requires a minimum of seven characters" },
    ],
    correctOptionId: "b",
    explanation:
      "62^5 is roughly 916 million, and the 10-year estimate is 365 billion links — you'd run out almost immediately. 62^7 leaves about 10x headroom over that volume, which is the margin you want before changing a format that's baked into every published link.",
  },
  {
    id: "us-3",
    phase: "high-level",
    question: "Why does a counter-based ID generator beat hashing the long URL and truncating?",
    options: [
      { id: "a", label: "It produces shorter codes" },
      { id: "b", label: "It avoids collisions by construction rather than by probability" },
      { id: "c", label: "Hashing is too slow at this request rate" },
      { id: "d", label: "It lets you reverse a code back into the URL" },
    ],
    correctOptionId: "b",
    explanation:
      "Truncating a hash discards exactly the bits that made it collision-resistant, so at billions of rows you must detect and retry collisions on write. Two requests can never be handed the same integer, so a counter makes collisions impossible rather than merely unlikely.",
  },
  {
    id: "us-4",
    phase: "deep-dive",
    question: "Why is cache-aside the right strategy here rather than write-through?",
    options: [
      { id: "a", label: "Write-through can't work with a key-value store" },
      { id: "b", label: "Cache-aside guarantees the cache is always warm" },
      { id: "c", label: "Write-through adds latency to creates without helping the read path that matters" },
      { id: "d", label: "Cache-aside uses less memory per entry" },
    ],
    correctOptionId: "c",
    explanation:
      "Creates are rare and not latency-critical; redirects are neither. Write-through would slow the operation nobody is waiting on, to pre-warm entries that may never be read. Populating lazily on the first read puts the cost exactly where the traffic is.",
  },
  {
    id: "us-5",
    phase: "bottlenecks",
    question: "A single auto-increment counter becomes a bottleneck across many API servers. What's the standard fix?",
    options: [
      { id: "a", label: "Pre-allocate disjoint ID ranges to each instance" },
      { id: "b", label: "Lock the counter row for each request" },
      { id: "c", label: "Let each server use a random ID and retry on collision" },
      { id: "d", label: "Move the counter into the cache" },
    ],
    correctOptionId: "a",
    explanation:
      "Handing each instance its own block — A takes 1..1,000,000, B takes the next million — removes per-request coordination entirely. Locking reintroduces the contention you're trying to remove, and random IDs bring back the collision problem the counter existed to avoid.",
  },
];
