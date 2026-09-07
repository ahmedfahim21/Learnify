import type { QuizQuestion } from "../quizTypes";

export const fileStorageQuiz: QuizQuestion[] = [
  {
    id: "fs-1",
    phase: "requirements",
    question: "Why is it useful to treat storage and sync as separate layers?",
    options: [
      { id: "a", label: "They're built by different teams" },
      { id: "b", label: "Durably storing bytes and propagating changes across devices are independent problems" },
      { id: "c", label: "Sync requires a different database engine" },
      { id: "d", label: "Storage is stateless and sync is stateful" },
    ],
    correctOptionId: "b",
    explanation:
      "The object store would be needed even for a single-device product; sync is the layer that notices a change and tells other devices. Keeping them separate makes each easier to reason about and scale.",
  },
  {
    id: "fs-2",
    phase: "data-model",
    question: "You change one line in a 2 GB file. Why does only a few megabytes upload?",
    options: [
      { id: "a", label: "The file is compressed before upload" },
      { id: "b", label: "Only chunks whose content hash changed are new; the rest already exist server-side" },
      { id: "c", label: "The server diffs old and new versions for you" },
      { id: "d", label: "Large files always upload incrementally by offset" },
    ],
    correctOptionId: "b",
    explanation:
      "Hashing each chunk by its content means unchanged chunks keep the same hash and are already stored. The same property gives deduplication for free — two users with identical files share the underlying chunks.",
  },
  {
    id: "fs-3",
    phase: "high-level",
    question: "What does content-addressed storage mean for durability strategy?",
    options: [
      { id: "a", label: "Chunks are immutable, so replication and erasure coding apply cleanly without update coordination" },
      { id: "b", label: "It removes the need for replication" },
      { id: "c", label: "Chunks must be stored on a single node to preserve their hash" },
      { id: "d", label: "It requires synchronous writes to every replica" },
    ],
    correctOptionId: "a",
    explanation:
      "A chunk identified by its content never changes — rewriting it would produce a different hash and therefore a different chunk. Immutability means replicas can never diverge, which is what makes erasure coding practical at this scale.",
  },
  {
    id: "fs-4",
    phase: "deep-dive",
    question: "Two devices edit the same file offline, then both reconnect. What's the safe resolution?",
    options: [
      { id: "a", label: "Keep the later timestamp and discard the other" },
      { id: "b", label: "Detect the concurrency and surface both versions rather than silently losing work" },
      { id: "c", label: "Automatically merge the binary contents" },
      { id: "d", label: "Reject both and ask the user to re-upload" },
    ],
    correctOptionId: "b",
    explanation:
      "A version vector can tell genuine concurrency from a simple sequence. For arbitrary file types there's no safe automatic merge, so keeping both as separate files is the honest outcome — never silently drop someone's edits.",
  },
  {
    id: "fs-5",
    phase: "bottlenecks",
    question: "Why tier storage by access frequency?",
    options: [
      { id: "a", label: "Cold files are more likely to be corrupted" },
      { id: "b", label: "Most bytes are never read again, so the vast majority can sit in much cheaper storage" },
      { id: "c", label: "Hot storage has stricter durability guarantees" },
      { id: "d", label: "It reduces the number of chunks per file" },
    ],
    correctOptionId: "b",
    explanation:
      "Access is heavily skewed: most files are uploaded once and rarely reopened. Moving chunks untouched for months to a cheaper, slower tier cuts the dominant cost while barely affecting the small set anyone actually uses.",
  },
];
