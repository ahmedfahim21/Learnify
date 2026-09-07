import type { QuizQuestion } from "../quizTypes";

export const proximityServiceQuiz: QuizQuestion[] = [
  {
    id: "ps-1",
    phase: "requirements",
    question: "Why can't two ordinary B-tree indexes on latitude and longitude answer 'what's within 2km'?",
    options: [
      { id: "a", label: "Floating-point columns can't be indexed" },
      { id: "b", label: "An index sorts on one dimension, so you scan a wide band and filter the rest" },
      { id: "c", label: "Distance requires trigonometry the index can't run" },
      { id: "d", label: "Coordinates change too often to index" },
    ],
    correctOptionId: "b",
    explanation:
      "Proximity is inherently two-dimensional. A single-dimension index can narrow one axis, but you still touch far more rows than actually fall inside the radius — which is exactly the gap geospatial indexes exist to close.",
  },
  {
    id: "ps-2",
    phase: "estimation",
    question: "What makes a uniform fixed-size grid a poor fit?",
    options: [
      { id: "a", label: "Real-world density is wildly uneven, so one cell size is wrong nearly everywhere" },
      { id: "b", label: "Grids can't be stored in a database" },
      { id: "c", label: "Cell boundaries change as the earth rotates" },
      { id: "d", label: "Grids require floating-point keys" },
    ],
    correctOptionId: "a",
    explanation:
      "A cell size fine enough for Manhattan wastes enormous index space over ocean and countryside. Adaptive schemes let dense areas subdivide further while sparse ones stay coarse.",
  },
  {
    id: "ps-3",
    phase: "data-model",
    question: "How does a geohash make proximity searchable with a normal index?",
    options: [
      { id: "a", label: "It stores distance directly in the key" },
      { id: "b", label: "It interleaves lat/lng bits into one sortable string, so nearby points usually share a prefix" },
      { id: "c", label: "It sorts results by distance automatically" },
      { id: "d", label: "It replaces coordinates with a city identifier" },
    ],
    correctOptionId: "b",
    explanation:
      "Collapsing two dimensions into one ordered string turns 'nearby' into 'shares a prefix' — a range scan any B-tree handles. The catch is boundaries: two close points can straddle a cell edge and share no prefix.",
  },
  {
    id: "ps-4",
    phase: "high-level",
    question: "Why does a geohash search also query neighbouring cells?",
    options: [
      { id: "a", label: "To increase the result count" },
      { id: "b", label: "Because points just across a cell boundary are close but share no prefix" },
      { id: "c", label: "To handle points with missing coordinates" },
      { id: "d", label: "Because the index is eventually consistent" },
    ],
    correctOptionId: "b",
    explanation:
      "Prefix matching alone would miss a restaurant fifty metres away that happens to fall in the adjacent cell. Expanding to neighbours and then computing true distance is what makes the result correct rather than merely fast.",
  },
  {
    id: "ps-5",
    phase: "deep-dive",
    question: "Why do constantly-moving entities like drivers need different handling from static businesses?",
    options: [
      { id: "a", label: "They need higher location accuracy" },
      { id: "b", label: "Re-indexing on disk every few seconds per entity doesn't scale, so they belong in an in-memory index" },
      { id: "c", label: "They can't be geohashed" },
      { id: "d", label: "Their coordinates use a different projection" },
    ],
    correctOptionId: "b",
    explanation:
      "A restaurant moves never; a driver moves every few seconds. That write rate, multiplied across every active driver, is far beyond what a disk-backed static index was designed for — hence a separate in-memory structure.",
  },
];
