import Link from "next/link";

import { getPrimaryDiagram, PROBLEMS } from "@/content/systemDesign";
import { QUIZ_BANK } from "@/content/systemDesign/quizzes";
import { SIMULATOR_IDS } from "@/lib/sims/ids";
import { ChapterBlockRenderer } from "@/components/course/ChapterBlockRenderer";
import { DiagramThumbnail } from "@/components/course/DiagramThumbnail";

const ACCENTS = ["signal", "deep", "warn", "flow", "accent", "alert"] as const;

/** The URL Shortener walkthrough, reused verbatim — the hero demo is a real
 *  diagram from a real concept, not a mock built for the landing page. */
const heroDiagram = PROBLEMS.find((p) => p.slug === "url-shortener")
  ?.chapters.find((c) => c.phase === "high-level")
  ?.blocks.find((b) => b.type === "diagram");

/** Counted from the curriculum at build time, so the numbers cannot drift
 *  away from what is actually in the product. */
const blocks = PROBLEMS.flatMap((p) => p.chapters.flatMap((c) => c.blocks));
const STATS = [
  { value: PROBLEMS.length, label: "concepts" },
  { value: blocks.filter((b) => b.type === "diagram").length, label: "diagrams" },
  { value: SIMULATOR_IDS.length, label: "simulators" },
  {
    value:
      Object.values(QUIZ_BANK).reduce((n, q) => n + q.length, 0) +
      blocks.filter((b) => b.type === "quiz").length,
    label: "questions",
  },
];

const STEPS = [
  {
    title: "Walk the request",
    body: "Numbered steps light one hop at a time — client, balancer, cache, store — each with a sentence explaining why it exists. Click any component to ask what it is doing there.",
  },
  {
    title: "Move the numbers",
    body: "Drag a cache hit ratio from 80% to 90% and watch origin load halve. Push a queue past 80% utilisation and watch latency run away. The arithmetic is real, not illustrative.",
  },
  {
    title: "Defend the design",
    body: "Every chapter ends with a question you have to answer before it counts as read. When you want to be pushed harder, a tutor works the whole concept adaptively.",
  },
];

export default function Home() {
  return (
    <main className="pb-24">
      <section className="wrap grid gap-12 pt-20 pb-16 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div className="min-w-0 space-y-7 rise">
          <div className="space-y-4">
            <p className="label">System design, in public</p>
            <h1 className="text-4xl leading-[1.08] sm:text-5xl">
              Most system design material
              <br />
              describes the diagram.
              <br />
              <span className="text-(--color-signal)">This one hands it to you.</span>
            </h1>
          </div>
          <p className="max-w-prose text-lg leading-relaxed text-(--color-mist)">
            {PROBLEMS.length} concepts, each built around an architecture you can step through
            one request at a time, sliders that recompute the trade-off as you move them, and a
            question at the end of every chapter that decides whether you actually have it.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/concepts" className="btn">
              Start with the curriculum
              <span className="arr arr-r">→</span>
            </Link>
            <Link href="/concepts/url-shortener" className="btn-quiet">
              Or open the URL shortener
            </Link>
          </div>
        </div>

        {heroDiagram?.type === "diagram" && (
          <div className="min-w-0 rise rise-2">
            <ChapterBlockRenderer block={heroDiagram} blockId="hero-diagram" />
          </div>
        )}
      </section>

      {/* Counted from the curriculum, so it is a description rather than a claim. */}
      <section className="wrap border-y border-(--color-line)">
        <dl className="grid grid-cols-2 divide-(--color-line) sm:grid-cols-4 sm:divide-x">
          {STATS.map((stat) => (
            <div key={stat.label} className="px-2 py-7 text-center">
              <dt className="sr-only">{stat.label}</dt>
              <dd>
                <span className="block text-4xl tabular-nums">{stat.value}</span>
                <span className="label mt-1 block">{stat.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="wrap space-y-8 py-16">
        <div className="label-rule">
          <span className="label">How it works</span>
        </div>
        <div className="grid gap-10 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="space-y-3">
              <span className="label tabular-nums" style={{ color: `var(--color-${ACCENTS[i]})` }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="text-xl">{step.title}</h2>
              <p className="text-sm leading-relaxed text-(--color-mist)">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap space-y-8 border-t border-(--color-line) py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="label-rule">
              <span className="label">The curriculum</span>
            </div>
            <p className="max-w-prose text-(--color-mist)">
              Fundamentals first — the pieces every design leans on — then the problems that put
              them together.
            </p>
          </div>
          <Link href="/concepts" className="link text-sm">
            All {PROBLEMS.length} with descriptions
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PROBLEMS.map((problem, i) => {
            const diagram = getPrimaryDiagram(problem);
            return (
              <Link
                key={problem.slug}
                href={`/concepts/${problem.slug}`}
                className="group flex flex-col border border-(--color-line) transition-colors hover:border-(--color-faint) hover:bg-(--color-surface)"
              >
                {diagram && (
                  <div className="border-b border-(--color-line) bg-(--color-canvas) px-3 py-3">
                    <DiagramThumbnail
                      diagram={diagram}
                      className="h-16 opacity-80 transition-opacity group-hover:opacity-100"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-2 p-4 pt-3">
                  <span
                    className="dot"
                    style={{ ["--scoop" as string]: `var(--color-${ACCENTS[i % ACCENTS.length]})` }}
                  />
                  <span className="text-sm text-(--color-fg)">{problem.title}</span>
                  <span className="label mt-auto">{problem.estimatedMinutes} min</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="wrap border-t border-(--color-line) py-16">
        <div className="max-w-(--measure-prose) space-y-5">
          <h2 className="text-3xl">Reading is free and needs no account.</h2>
          <p className="text-(--color-mist)">
            Every concept, diagram, simulator and written quiz is open. An account only starts
            mattering when you want the tutor, and want the parts you got wrong to come back
            later.
          </p>
          <Link href="/concepts" className="btn">
            Open the curriculum
            <span className="arr arr-r">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
