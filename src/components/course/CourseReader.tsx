"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  DESIGN_PHASE_LABELS,
  type DesignPhase,
  type SystemDesignProblem,
} from "@/content/systemDesign/types";

import { useSession } from "@/lib/authClient";

import { ChapterBlockRenderer } from "./ChapterBlockRenderer";
import { useChapterProgress } from "./useChapterProgress";

const SCOOPS = ["blueberry", "mint", "mango", "grape", "bubblegum", "strawberry", "blueberry"] as const;

/**
 * The chaptered course reader — a sidebar of chapters (scroll-spied to
 * highlight the one in view) beside a single scrolling column of prose and
 * embedded widgets, in the spirit of an explorable-explanation site: read
 * top to bottom, or jump straight to a chapter from the rail.
 *
 * Reading is fully static (no DB, no LLM call). "Start practicing" is the
 * one action that talks to the server: it materializes this course into a
 * topic (idempotent) and launches a live tutor session scoped to that
 * chapter's concepts.
 */
export function CourseReader({ problem }: { problem: SystemDesignProblem }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [activePhase, setActivePhase] = useState(problem.chapters[0]?.phase);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const allConceptSlugs = problem.chapters.flatMap((c) => c.concepts.map((x) => x.slug));
  const phases = useMemo(() => problem.chapters.map((c) => c.phase), [problem]);
  const { completed } = useChapterProgress(problem.slug, phases, Boolean(session?.user));
  const readCount = phases.filter((p) => completed.has(p)).length;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActivePhase(visible.target.id.replace("chapter-", "") as DesignPhase);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    for (const el of Object.values(sectionRefs.current)) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  async function startPracticing(conceptSlugs: string[]) {
    setStarting(conceptSlugs.join(","));
    setError(null);
    try {
      const startResponse = await fetch(`/api/problems/${problem.slug}/start`, { method: "POST" });
      if (!startResponse.ok) throw new Error("Could not start this course.");
      const { topicId, concepts } = (await startResponse.json()) as {
        topicId: string;
        concepts: { id: string; slug: string }[];
      };

      // Scope the session to just the concepts this chapter teaches.
      const conceptIds = conceptSlugs
        .map((slug) => concepts.find((c) => c.slug === slug)?.id)
        .filter((id): id is string => Boolean(id));

      const sessionResponse = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, conceptIds, kind: "learn" }),
      });
      if (!sessionResponse.ok) throw new Error("Could not start a session.");
      const { session } = (await sessionResponse.json()) as { session: { id: string } };
      router.push(`/session/${session.id}`);
    } catch {
      setError("Something went wrong starting practice. Try again.");
      setStarting(null);
    }
  }

  return (
    <div className="wrap grid gap-10 py-10 lg:grid-cols-[220px_1fr]">
      <aside className="min-w-0 lg:sticky lg:top-10 lg:h-fit">
        <div className="mb-3 space-y-2">
          <p className="label">Chapters</p>
          {session?.user && (
            <>
              <div className="h-0.5 w-full overflow-hidden bg-(--color-line)">
                <div
                  className="h-full bg-(--color-mint) transition-[width] duration-500"
                  style={{ width: `${(readCount / phases.length) * 100}%` }}
                />
              </div>
              <p className="label">
                {readCount} / {phases.length} read
              </p>
            </>
          )}
        </div>
        <nav className="flex flex-col gap-1 border-l border-(--color-line) pl-3">
          {problem.chapters.map((chapter, i) => {
            const active = activePhase === chapter.phase;
            return (
              <a
                key={chapter.phase}
                href={`#chapter-${chapter.phase}`}
                className={`-ml-3 border-l pl-3 py-1 text-sm transition-colors ${
                  active
                    ? "border-(--color-mint) text-(--color-fg)"
                    : "border-transparent text-(--color-mist) hover:text-(--color-fg)"
                }`}
              >
                <span className="label mr-2">
                  {completed.has(chapter.phase) ? "✓" : String(i).padStart(2, "0")}
                </span>
                {chapter.title}
              </a>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0 max-w-(--measure-mid) space-y-16">
        <header className="max-w-(--measure-prose) space-y-4 rise">
          <p className="label">{problem.tags.join(" · ")}</p>
          <h1 className="text-3xl">{problem.title}</h1>
          <p className="text-(--color-mist)">{problem.tagline}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="chip">{problem.estimatedMinutes} min</span>
            <span className="chip">difficulty {problem.difficulty}/5</span>
          </div>
        </header>

        {error && (
          <p className="border border-(--color-strawberry)/40 bg-(--color-strawberry)/10 px-4 py-2 text-sm text-(--color-strawberry)">
            {error}
          </p>
        )}

        {problem.chapters.map((chapter, i) => {
          const scoop = SCOOPS[i % SCOOPS.length];
          return (
            <section
              key={chapter.phase}
              id={`chapter-${chapter.phase}`}
              ref={(el) => {
                sectionRefs.current[chapter.phase] = el;
              }}
              className="scroll-mt-10 space-y-6"
            >
              <div className="label-rule">
                <span className="label flex items-center gap-2">
                  <span className="dot" style={{ ["--scoop" as string]: `var(--color-${scoop})` }} />
                  {DESIGN_PHASE_LABELS[chapter.phase]}
                </span>
              </div>
              <h2 className="max-w-(--measure-prose) text-2xl">{chapter.title}</h2>
              <p className="max-w-(--measure-prose) text-(--color-mist)">{chapter.summary}</p>

              <div className="space-y-6">
                {chapter.blocks.map((block, blockIndex) => (
                  <ChapterBlockRenderer
                    key={blockIndex}
                    block={block}
                    blockId={`${problem.slug}-${chapter.phase}-${blockIndex}`}
                  />
                ))}
              </div>

            </section>
          );
        })}

        <section className="max-w-(--measure-prose) space-y-4 border border-(--color-mint)/30 bg-(--color-mint)/[0.04] p-6">
          <p className="label">Finished reading</p>
          <h2 className="text-2xl">Now get grilled on it</h2>
          <p className="text-(--color-mist)">
            The tutor works through {problem.title} adaptively — it diagnoses what you
            already know, presses on the parts you answer poorly, and schedules whatever
            stayed shaky for review.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => startPracticing(allConceptSlugs)}
              disabled={Boolean(starting)}
              className="chip border-(--color-mint)/50 bg-(--color-mint)/10 text-(--color-mint) disabled:cursor-wait disabled:opacity-60"
            >
              {starting ? "Starting…" : `Start a tutor session on all ${allConceptSlugs.length} concepts →`}
            </button>
            <Link href={`/courses/${problem.slug}/quiz`} className="chip">
              or take the written quiz
            </Link>
          </div>
          <p className="label">
            The tutor adapts and needs an account; the quiz is pre-written, works signed out,
            and uses no budget.
          </p>
        </section>
      </main>
    </div>
  );
}
