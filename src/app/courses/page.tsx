import Link from "next/link";

import { getPrimaryDiagram, PROBLEMS } from "@/content/systemDesign";
import { CourseProgressBadge } from "@/components/course/CourseProgressBadge";
import { getQuiz } from "@/content/systemDesign/quizzes";
import { DiagramThumbnail } from "@/components/course/DiagramThumbnail";
import { DifficultyPips } from "@/components/course/DifficultyPips";

const SCOOPS = ["signal", "deep", "warn", "flow", "accent", "alert"] as const;

export const metadata = {
  title: "Courses",
  description: "The full curated system-design interview curriculum — animated diagrams, explorable simulators, an adaptive AI tutor.",
};

/** The course catalog — a static server component reading the authored
 *  registry directly, no DB round trip, fully cacheable. */
export default function CoursesPage() {
  return (
    <main className="wrap py-16">
      <header className="mb-12 max-w-(--measure-prose) space-y-3">
        <p className="label">Courses</p>
        <h1 className="text-3xl">The system design curriculum</h1>
        <p className="text-(--color-mist)">
          Sixteen courses covering the canonical interview problems — each one an animated
          walkthrough of requirements, estimation, API, data model, high-level design, a deep
          dive, and where it breaks at 10x. Read it like a book, or jump into any chapter with the
          adaptive tutor.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROBLEMS.map((problem, i) => {
          const scoop = SCOOPS[i % SCOOPS.length];
          const diagram = getPrimaryDiagram(problem);
          return (
            <Link
              key={problem.slug}
              href={`/courses/${problem.slug}`}
              className="group flex flex-col gap-3 border border-(--color-line) p-5 transition-colors hover:border-(--color-faint) hover:bg-(--color-surface)"
            >
              {/* The course's own architecture, so the catalog reads as a set
                  of shapes rather than a wall of paragraphs. */}
              {diagram && (
                <div className="-mx-5 -mt-5 mb-1 border-b border-(--color-line) bg-(--color-canvas) px-5 py-4">
                  <DiagramThumbnail diagram={diagram} className="h-24" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="dot" style={{ ["--scoop" as string]: `var(--color-${scoop})` }} />
                <span className="label">{problem.tags[0]}</span>
              </div>
              <h2 className="text-lg text-(--color-fg)">{problem.title}</h2>
              <p className="flex-1 text-sm text-(--color-mist)">{problem.tagline}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="chip">{problem.estimatedMinutes} min</span>
                <DifficultyPips level={problem.difficulty} />
                <span className="chip">{problem.chapters.length} chapters</span>
                <CourseProgressBadge slug={problem.slug} />
                <span className="chip">{getQuiz(problem.slug).length} quiz questions</span>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
