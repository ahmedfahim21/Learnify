import Link from "next/link";
import { redirect } from "next/navigation";

import { getPrimaryDiagram, getProblem, PROBLEMS } from "@/content/systemDesign";
import { getTodaySnapshot } from "@/lib/mastery/engine";
import { getCourseProgress, getKnowledgeGraph } from "@/lib/progress";
import { getCurrentUser } from "@/lib/session";
import { KnowledgeGraphView } from "@/components/graph/KnowledgeGraph";
import { DiagramThumbnail } from "@/components/course/DiagramThumbnail";

export const metadata = { title: "Your progress" };

const ACCENTS = ["signal", "deep", "warn", "flow"] as const;

export default async function MePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/me");

  const [progress, graph, today] = await Promise.all([
    getCourseProgress(user.id),
    getKnowledgeGraph(user.id),
    getTodaySnapshot(user.id),
  ]);

  const started = progress.filter((p) => p.completedPhases.length > 0);
  const finished = progress.filter((p) => p.fraction >= 1);
  const notStarted = progress.filter((p) => p.completedPhases.length === 0);
  const assessed = graph.nodes.filter((n) => n.score !== null);
  const mastered = assessed.filter((n) => (n.score ?? 0) >= 0.8);

  // Chapters read across everything — a number that moves on the first
  // session, unlike "concepts finished", which can sit at zero for a while.
  const chaptersRead = progress.reduce((sum, p) => sum + p.completedPhases.length, 0);
  const totalChapters = progress.reduce((sum, p) => sum + p.totalChapters, 0);

  const stats = [
    { label: "Chapters read", value: chaptersRead, of: totalChapters },
    { label: "Concepts finished", value: finished.length, of: PROBLEMS.length },
    { label: "Skills mastered", value: mastered.length, of: assessed.length },
    { label: "Day streak", value: today.streak.current, of: null },
  ];

  return (
    <main className="wrap space-y-14 py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="label">{user.email}</p>
          <h1 className="text-3xl">{user.name ?? "Your progress"}</h1>
        </div>
        {today.due.length > 0 && (
          <Link href="/today" className="btn">
            {today.due.length} due for review
            <span className="arr arr-r">→</span>
          </Link>
        )}
      </header>

      {/* Numbers lead, with a bar underneath so a glance reads as a shape
          rather than four fractions to parse. */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat, i) => {
          const accent = ACCENTS[i % ACCENTS.length];
          const pct = stat.of ? (stat.value / Math.max(stat.of, 1)) * 100 : 0;
          return (
            <div key={stat.label} className="space-y-3 border border-(--color-line) bg-(--color-surface) p-5">
              <p className="label">{stat.label}</p>
              <p className="flex items-baseline gap-1.5">
                <span
                  className="text-4xl tabular-nums"
                  style={{ color: `var(--color-${accent})` }}
                >
                  {stat.value}
                </span>
                {stat.of !== null && (
                  <span className="text-sm text-(--color-faint) tabular-nums">/ {stat.of}</span>
                )}
              </p>
              {stat.of !== null && (
                <div className="h-1 w-full overflow-hidden bg-(--color-line)">
                  <div
                    className="h-full transition-[width] duration-500"
                    style={{ width: `${pct}%`, background: `var(--color-${accent})` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </section>

      {started.length > 0 && (
        <section className="space-y-4">
          <div className="label-rule">
            <span className="label">In progress</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {started
              .slice()
              .sort((a, b) => b.fraction - a.fraction)
              .map((course) => {
                const problem = getProblem(course.problemSlug);
                const diagram = problem ? getPrimaryDiagram(problem) : undefined;
                const done = course.fraction >= 1;
                return (
                  <Link
                    key={course.problemSlug}
                    href={`/concepts/${course.problemSlug}`}
                    className="group flex flex-col border border-(--color-line) transition-colors hover:border-(--color-faint) hover:bg-(--color-surface)"
                  >
                    {diagram && (
                      <div className="border-b border-(--color-line) bg-(--color-canvas) px-4 py-3">
                        <DiagramThumbnail diagram={diagram} className="h-16 opacity-70 transition-opacity group-hover:opacity-100" />
                      </div>
                    )}
                    <div className="space-y-2 p-4">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm text-(--color-fg)">{problem?.title ?? course.problemSlug}</span>
                        <span className="label shrink-0">
                          {done ? "done" : `${course.completedPhases.length}/${course.totalChapters}`}
                        </span>
                      </div>
                      <div className="h-1 w-full overflow-hidden bg-(--color-line)">
                        <div
                          className={`h-full ${done ? "bg-(--color-deep)" : "bg-(--color-signal)"}`}
                          style={{ width: `${course.fraction * 100}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="label-rule">
          <span className="label">{started.length > 0 ? "Not started" : "Concepts"}</span>
        </div>
        {/* Unstarted concepts get a compact list rather than sixteen identical
            cards with empty progress bars — nothing there is worth the space. */}
        <div className="flex flex-wrap gap-2">
          {notStarted.map((course) => (
            <Link key={course.problemSlug} href={`/concepts/${course.problemSlug}`} className="chip">
              {getProblem(course.problemSlug)?.title ?? course.problemSlug}
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="label-rule">
          <span className="label">Knowledge graph</span>
        </div>
        {graph.nodes.length > 0 ? (
          <KnowledgeGraphView graph={graph} />
        ) : (
          <div className="flex flex-col items-center gap-3 border border-dashed border-(--color-line) bg-(--color-surface) px-6 py-12 text-center">
            <svg viewBox="0 0 220 90" aria-hidden className="h-20 w-56 opacity-60">
              {[
                { x: 12, y: 34, a: "signal" },
                { x: 88, y: 12, a: "deep" },
                { x: 88, y: 56, a: "warn" },
                { x: 164, y: 34, a: "flow" },
              ].map((n) => (
                <rect
                  key={`${n.x}-${n.y}`}
                  x={n.x}
                  y={n.y}
                  width={44}
                  height={22}
                  rx={3}
                  fill="var(--color-node)"
                  stroke={`var(--color-${n.a})`}
                  strokeWidth={1.5}
                />
              ))}
              {[
                "M56 45 L88 23", "M56 45 L88 67", "M132 23 L164 45", "M132 67 L164 45",
              ].map((d) => (
                <path key={d} d={d} stroke="var(--color-faint)" strokeWidth={1.5} fill="none" />
              ))}
            </svg>
            <p className="max-w-md text-sm text-(--color-mist)">
              Read a chapter and its skills appear here, linked to every other concept that
              teaches the same idea. Practising shades them by how well you know them.
            </p>
            <Link href="/concepts" className="btn-quiet">
              Pick a concept
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
