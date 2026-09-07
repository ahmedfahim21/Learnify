import type { QuizQuestion } from "../quizTypes";

export const uniqueIdGeneratorQuiz: QuizQuestion[] = [
  {
    id: "id-1",
    phase: "requirements",
    question: "Why isn't a random UUID enough for this problem?",
    options: [
      { id: "a", label: "UUIDs are not unique enough at scale" },
      { id: "b", label: "They carry no time order, so index inserts land randomly instead of appending" },
      { id: "c", label: "They are too slow to generate" },
      { id: "d", label: "They can't be stored in 64 bits" },
    ],
    correctOptionId: "b",
    explanation:
      "Uniqueness is the easy half. Random UUIDs scatter B-tree inserts across the whole index rather than appending at the end, which is markedly slower. The interesting requirement is uniqueness *and* rough time ordering at once.",
  },
  {
    id: "id-2",
    phase: "data-model",
    question: "In a Snowflake-style 64-bit layout, what do the high bits hold and why?",
    options: [
      { id: "a", label: "The machine id, so ids group by server" },
      { id: "b", label: "A timestamp, so sorting the raw integer sorts by time" },
      { id: "c", label: "A checksum, to detect corruption" },
      { id: "d", label: "The sequence counter, so bursts stay contiguous" },
    ],
    correctOptionId: "b",
    explanation:
      "Putting milliseconds in the most significant bits means ordinary integer comparison orders ids chronologically — the property a random UUID can't give you. Machine id and per-millisecond sequence sit below it purely to guarantee uniqueness.",
  },
  {
    id: "id-3",
    phase: "high-level",
    question: "Two generators mint an id in the same millisecond with the same sequence number. What prevents a collision?",
    options: [
      { id: "a", label: "They coordinate through a shared lock" },
      { id: "b", label: "Their machine-id bits differ, so the full 64-bit values differ" },
      { id: "c", label: "One retries after detecting the clash" },
      { id: "d", label: "Nothing — collisions are possible but rare" },
    ],
    correctOptionId: "b",
    explanation:
      "Uniqueness here is structural, not coordinated. The machine-id bits partition the id space so two machines simply cannot produce the same value — which is what lets generateId() be a local function call with no lock and no network hop.",
  },
  {
    id: "id-4",
    phase: "deep-dive",
    question: "NTP steps a generator's clock backwards. What should it do?",
    options: [
      { id: "a", label: "Keep generating; the sequence counter prevents reuse" },
      { id: "b", label: "Refuse to generate until real time passes the last timestamp it used" },
      { id: "c", label: "Switch to random ids until the clock recovers" },
      { id: "d", label: "Borrow a timestamp from another generator" },
    ],
    correctOptionId: "b",
    explanation:
      "The whole scheme assumes time only moves forward; going backwards risks reissuing a timestamp-and-sequence pair already used. Tracking the last timestamp and refusing (or briefly blocking) trades a tiny unavailability window for never minting a duplicate.",
  },
  {
    id: "id-5",
    phase: "bottlenecks",
    question: "With a 12-bit sequence, one machine tops out around 4,096 ids per millisecond. How do you scale past it?",
    options: [
      { id: "a", label: "Add another machine with an unused machine id" },
      { id: "b", label: "Widen the timestamp field" },
      { id: "c", label: "Introduce a shared counter service" },
      { id: "d", label: "Reduce the machine-id bits to grow the sequence" },
    ],
    correctOptionId: "a",
    explanation:
      "Scaling out is exactly what the machine-id bits exist for — a new generator needs no coordination beyond being assigned an unused id. A shared counter would reintroduce the central bottleneck the design was built to avoid.",
  },
];
