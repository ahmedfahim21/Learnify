import Link from "next/link";

import { getPrimaryDiagram, PROBLEMS } from "@/content/systemDesign";
import { ChapterBlockRenderer } from "@/components/course/ChapterBlockRenderer";
import { DiagramThumbnail } from "@/components/course/DiagramThumbnail";

const SCOOPS = ["signal", "deep", "warn", "flow", "accent", "alert"] as const;

/** The walkthrough from the URL Shortener concept, reused verbatim on the
 *  landing page — the hero demo is a real diagram, not a mock. */
const heroDiagram = PROBLEMS.find((p) => p.slug === "url-shortener")
  ?.chapters.find((c) => c.phase === "high-level")
  ?.blocks.find((b) => b.type === "diagram");

export default function Home() {
  return (
    <main className="pb-24">
      <section className="wrap grid gap-10 pt-16 pb-14 lg:grid-cols-[1fr_1.15fr] lg:items-center">
        <div className="min-w-0 space-y-6 rise">
          <p className="label">16 concepts · animated · interactive</p>
          <h1 className="text-4xl leading-[1.1] sm:text-5xl">
            System design, explained by the diagram — not around it.
          </h1>
          <p className="max-w-prose text-(--color-mist)">
            Every concept walks one request end to end through an animated architecture
            diagram, then hands you the sliders: cache hit ratios, queue backpressure,
            consistent hashing. When you want to be pushed, an adaptive tutor grills you on
            the same material.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/concepts"
              className="border border-(--color-signal)/50 bg-(--color-signal)/10 px-5 py-2.5 text-(--color-signal) transition-colors hover:bg-(--color-signal)/20"
            >
              Browse the concepts <span className="arr arr-r">→</span>
            </Link>
            <Link
              href="/concepts/url-shortener"
              className="px-3 py-2.5 text-(--color-mist) transition-colors hover:text-(--color-fg)"
            >
              Start with the URL shortener
            </Link>
          </div>
        </div>

        {heroDiagram?.type === "diagram" && (
          <div className="min-w-0 rise rise-2">
            <ChapterBlockRenderer block={heroDiagram} blockId="hero-diagram" />
          </div>
        )}
      </section>

      <section className="wrap space-y-6 border-t border-(--color-line) py-14">
        <div className="label-rule">
          <span className="label">How it works</span>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {[
            {
              title: "Walk the request",
              body: "Numbered steps light up one hop at a time — client, load balancer, cache, store — with a caption for each. Click any component to ask what it's doing there.",
            },
            {
              title: "Move the numbers",
              body: "Drag a cache hit ratio from 80% to 90% and watch origin load halve. Push utilisation past 0.8 and watch latency run away. The maths is real, not illustrative.",
            },
            {
              title: "Get grilled",
              body: "Any chapter hands off to a live tutor that diagnoses what you know, adapts to wrong answers, and schedules what you got shaky for review.",
            },
          ].map((feature, i) => (
            <div key={feature.title} className="space-y-2">
              <span
                className="dot"
                style={{ ["--scoop" as string]: `var(--color-${SCOOPS[i]})` }}
              />
              <h2 className="text-lg">{feature.title}</h2>
              <p className="text-sm text-(--color-mist)">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap space-y-6 border-t border-(--color-line) py-14">
        <div className="label-rule">
          <span className="label">The curriculum</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PROBLEMS.map((problem, i) => {
            const diagram = getPrimaryDiagram(problem);
            return (
              <Link
                key={problem.slug}
                href={`/concepts/${problem.slug}`}
                className="group flex flex-col gap-2 border border-(--color-line) transition-colors hover:border-(--color-faint) hover:bg-(--color-surface)"
              >
                {diagram && (
                  <div className="border-b border-(--color-line) bg-(--color-canvas) px-3 py-3">
                    <DiagramThumbnail diagram={diagram} className="h-16 opacity-80 transition-opacity group-hover:opacity-100" />
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-2 p-4 pt-2">
                  <span
                    className="dot"
                    style={{ ["--scoop" as string]: `var(--color-${SCOOPS[i % SCOOPS.length]})` }}
                  />
                  <span className="text-sm text-(--color-fg)">{problem.title}</span>
                  <span className="label mt-auto">{problem.estimatedMinutes} min</span>
                </div>
              </Link>
            );
          })}
        </div>
        <Link href="/concepts" className="link inline-block text-sm">
          See all 16 with descriptions
        </Link>
      </section>
    </main>
  );
}
