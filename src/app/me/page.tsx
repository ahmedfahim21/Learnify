import Link from "next/link";
import { redirect } from "next/navigation";

import { PROBLEMS } from "@/content/systemDesign";
import { getTodaySnapshot } from "@/lib/mastery/engine";
import { getCourseProgress, getKnowledgeGraph } from "@/lib/progress";
import { getCurrentUser } from "@/lib/session";
import { KnowledgeGraphView } from "@/components/graph/KnowledgeGraph";

export const metadata = { title: "Your progress" };

export default async function MePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/me");

  // Reuses the Today snapshot rather than adding a second way to read the
  // streak, and the due count is worth surfacing here anyway.
  const [progress, graph, today] = await Promise.all([
    getCourseProgress(user.id),
    getKnowledgeGraph(user.id),
    getTodaySnapshot(user.id),
  ]);

  const started = progress.filter((p) => p.completedPhases.length > 0);
  const finished = progress.filter((p) => p.fraction >= 1);
  const assessed = graph.nodes.filter((n) => n.score !== null);
  const mastered = assessed.filter((n) => (n.score ?? 0) >= 0.8);
  const titleOf = (slug: string) => PROBLEMS.find((p) => p.slug === slug)?.title ?? slug;

  return (
    <main className="wrap space-y-12 py-12">
      <header className="space-y-2">
        <p className="label">{user.email}</p>
        <h1 className="text-3xl">{user.name ?? "Your progress"}</h1>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Courses started", value: `${started.length}` },
          { label: "Courses finished", value: `${finished.length} / ${PROBLEMS.length}` },
          { label: "Concepts mastered", value: `${mastered.length} / ${assessed.length || 0}` },
          { label: "Day streak", value: `${today.streak.current}` },
        ].map((stat) => (
          <div key={stat.label} className="border border-(--color-line) p-4">
            <p className="label">{stat.label}</p>
            <p className="text-2xl tabular-nums text-(--color-fg)">{stat.value}</p>
          </div>
        ))}
      </section>

      {today.due.length > 0 && (
        <Link
          href="/today"
          className="flex items-center justify-between gap-3 border border-(--color-signal)/30 bg-(--color-signal)/[0.05] px-4 py-3 transition-colors hover:bg-(--color-signal)/10"
        >
          <span className="text-(--color-fg)">
            {today.due.length} concept{today.due.length === 1 ? "" : "s"} due for review
          </span>
          <span className="label text-(--color-signal)">Review now →</span>
        </Link>
      )}

      <section className="space-y-4">
        <div className="label-rule">
          <span className="label">Courses</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {progress
            .slice()
            .sort((a, b) => b.fraction - a.fraction)
            .map((course) => (
              <Link
                key={course.problemSlug}
                href={`/courses/${course.problemSlug}`}
                className="flex items-center gap-3 border border-(--color-line) px-4 py-3 transition-colors hover:border-(--color-faint) hover:bg-(--color-surface)"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-(--color-fg)">{titleOf(course.problemSlug)}</p>
                  <div className="mt-1.5 h-0.5 w-full overflow-hidden bg-(--color-line)">
                    <div
                      className="h-full bg-(--color-signal)"
                      style={{ width: `${course.fraction * 100}%` }}
                    />
                  </div>
                </div>
                <span className="label shrink-0">
                  {course.completedPhases.length}/{course.totalChapters}
                </span>
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
          <p className="text-(--color-mist)">
            Nothing here yet. Concepts appear once you start a tutor session on a course —{" "}
            <Link href="/courses" className="link">
              pick one
            </Link>
            .
          </p>
        )}
      </section>
    </main>
  );
}
