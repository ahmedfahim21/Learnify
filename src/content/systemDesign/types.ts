import type { SystemDiagramProps } from "@/lib/a2ui/catalog";
import type { SimulatorId } from "@/lib/sims/ids";

/**
 * Authored system-design course content — typed data, compile-checked against
 * the same widget schemas the live tutor emits against (an authored diagram's
 * `props` is literally `SystemDiagramProps`, so a bad diagram is a TypeScript
 * error before it's ever a runtime one).
 *
 * A course reads like a book: seven chapters, one per interview stage. Each
 * chapter is prose sections interleaved with authored widgets (diagrams,
 * simulators) rendered statically on the page — no LLM call needed to read a
 * course. The live tutor session is a separate "practice this chapter" mode,
 * reachable from within the reader, that teaches the same concepts adaptively.
 */
export const DESIGN_PHASES = [
  "requirements",
  "estimation",
  "api",
  "data-model",
  "high-level",
  "deep-dive",
  "bottlenecks",
] as const;

export type DesignPhase = (typeof DESIGN_PHASES)[number];

export const DESIGN_PHASE_LABELS: Record<DesignPhase, string> = {
  requirements: "Requirements",
  estimation: "Estimation",
  api: "API design",
  "data-model": "Data model",
  "high-level": "High-level design",
  "deep-dive": "Deep dive",
  bottlenecks: "Bottlenecks & trade-offs",
};

/** One prose block or embedded widget within a chapter, rendered top to bottom. */
export type ChapterBlock =
  | { type: "prose"; heading?: string; body: string }
  | { type: "diagram"; diagram: SystemDiagramProps }
  | {
      type: "simulator";
      simulatorId: SimulatorId;
      title?: string;
      intro?: string;
      notice: string;
      params?: { key: string; value: number | boolean }[];
    }
  | { type: "callout"; tone: "note" | "tradeoff" | "pitfall"; body: string }
  /**
   * A self-graded check. Answered and explained entirely client-side — no LLM
   * call, no session — so a reader can test themselves mid-chapter without
   * leaving the page. The adaptive tutor is a separate, once-per-course thing.
   */
  | {
      type: "quiz";
      question: string;
      options: { id: string; label: string }[];
      correctOptionId: string;
      /** Shown after answering, whichever option was chosen. */
      explanation: string;
    };

/** A concept the mastery engine tracks — materialized 1:1 into the `concepts`
 *  table. Every chapter teaches at least one. */
export interface AuthoredConcept {
  slug: string;
  name: string;
  summary: string;
  /** 1 (foundational) .. 5 (advanced). */
  difficulty: number;
}

export interface CourseChapter {
  phase: DesignPhase;
  title: string;
  /** One-sentence dek shown in the chapter nav / TOC. */
  summary: string;
  /** Concepts this chapter teaches, in reading order. */
  concepts: AuthoredConcept[];
  blocks: ChapterBlock[];
}

export interface SystemDesignProblem {
  slug: string;
  title: string;
  tagline: string;
  /** 1 (foundational) .. 5 (advanced). */
  difficulty: number;
  estimatedMinutes: number;
  tags: string[];
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  chapters: CourseChapter[];
}

/** Every concept across a course's chapters, in reading order — the order
 *  `materializeProblem` assigns as `orderIndex`. */
export function flattenConcepts(
  problem: SystemDesignProblem,
): (AuthoredConcept & { phase: DesignPhase })[] {
  return problem.chapters.flatMap((chapter) =>
    chapter.concepts.map((concept) => ({ ...concept, phase: chapter.phase })),
  );
}

/** A linear prerequisite chain across a course's chapters and their internal
 *  concepts (each concept depends on the one before it) — the DAG
 *  `materializeProblem` persists as concept_edges. Courses read start to
 *  finish, so this is intentionally a chain, not a richer graph. */
export function chainEdges(problem: SystemDesignProblem): { from: string; to: string }[] {
  const slugs = flattenConcepts(problem).map((c) => c.slug);
  const edges: { from: string; to: string }[] = [];
  for (let i = 1; i < slugs.length; i++) {
    edges.push({ from: slugs[i - 1], to: slugs[i] });
  }
  return edges;
}
