"use client";

import { Loader2, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { CourseCard, CourseCardSkeleton, disciplineColour } from "@/components/courses/CourseCard";
import type { CourseDto, Discipline } from "@/lib/courses/repo";

/** Browse NPTEL video courses. Reads /api/courses; search is debounced. */
export default function CoursesPage() {
  const [q, setQ] = useState("");
  const [discipline, setDiscipline] = useState<number | null>(null);
  const [disciplines, setDisciplines] = useState<Discipline[] | null>(null);
  const [courses, setCourses] = useState<CourseDto[] | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  async function load(cursor?: number) {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (discipline !== null) params.set("discipline", String(discipline));
    if (cursor) params.set("cursor", String(cursor));
    const res = await fetch(`/api/courses?${params}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `GET /api/courses → HTTP ${res.status}`);
    return body as { courses: CourseDto[]; nextCursor: number | null; disciplines?: Discipline[] };
  }

  useEffect(() => {
    const t = setTimeout(() => {
      setCourses(null);
      setError(null);
      load().then(
        (page) => {
          setCourses(page.courses);
          setNextCursor(page.nextCursor);
          if (page.disciplines) setDisciplines((d) => d ?? page.disciplines!);
        },
        (err: Error) => {
          console.error("loading courses failed:", err);
          setError(err.message);
        },
      );
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when the query, filter or a retry changes
  }, [q, discipline, attempt]);

  function loadMore() {
    if (!nextCursor || !courses) return;
    setLoadingMore(true);
    load(nextCursor)
      .then(
        (page) => {
          setCourses([...courses, ...page.courses]);
          setNextCursor(page.nextCursor);
        },
        (err: Error) => {
          console.error("loading more courses failed:", err);
          setError(err.message);
        },
      )
      .finally(() => setLoadingMore(false));
  }

  const total = disciplines?.reduce((n, d) => n + d.courses, 0);
  const filtered = q.trim() !== "" || discipline !== null;
  const clear = () => {
    setQ("");
    setDiscipline(null);
  };

  return (
    <main className="pb-12">
      <div className="wrap space-y-2 pt-10 pb-6">
        <h1 className="text-4xl tracking-tight sm:text-5xl">Pick a course</h1>
        <p className="text-lg text-(--color-mist)">
          {total ? `${total.toLocaleString("en-IN")} NPTEL video courses` : "NPTEL video courses"} from IIT and IISc faculty.
        </p>
      </div>

      {/* Search and subjects stay in reach while the list scrolls. */}
      <div className="sticky top-14 z-20 border-y border-(--color-line) bg-(--color-ink)/90 backdrop-blur">
        <div className="wrap space-y-3 py-3">
          <label className="relative block max-w-2xl">
            <span className="sr-only">Search courses</span>
            <Search size={18} aria-hidden className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-(--color-faint)" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title, professor or institute"
              className="min-h-12 w-full rounded-full border border-(--color-line) bg-(--color-node) pr-12 pl-11 outline-none focus:border-(--color-signal) [&::-webkit-search-cancel-button]:hidden"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-(--color-mist) hover:bg-(--color-raised)"
              >
                <X size={16} aria-hidden />
              </button>
            )}
          </label>
          <div role="toolbar" aria-label="Filter by subject" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
            {disciplines === null
              ? Array.from({ length: 8 }, (_, i) => <span key={i} className="h-9 w-28 shrink-0 animate-pulse rounded-full bg-(--color-raised)" />)
              : [{ id: null, name: "All subjects", courses: total ?? 0 } as { id: number | null; name: string; courses: number }, ...disciplines].map((d) => {
                  const on = discipline === d.id;
                  const colour = d.id === null ? "var(--color-fg)" : disciplineColour(d.id);
                  return (
                    <button
                      key={d.id ?? "all"}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDiscipline(d.id)}
                      className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors"
                      style={{
                        borderColor: on ? colour : "var(--color-line)",
                        background: on ? colour : "var(--color-node)",
                        color: on ? "white" : "var(--color-fg)",
                      }}
                    >
                      {d.id !== null && <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: on ? "white" : colour }} />}
                      {d.name}
                      <span className="font-mono text-xs opacity-70">{d.courses}</span>
                    </button>
                  );
                })}
          </div>
        </div>
      </div>

      <div className="wrap space-y-6 pt-8">
        {error ? (
          <div role="alert" className="flex flex-wrap items-center gap-4 rounded-2xl border border-(--color-alert)/30 p-5">
            <p className="text-(--color-alert)">Couldn&apos;t load courses: {error}</p>
            <button type="button" onClick={() => setAttempt((a) => a + 1)} className="min-h-10 rounded-full border border-(--color-line) px-4 hover:border-(--color-signal)">
              Try again
            </button>
          </div>
        ) : !courses ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }, (_, i) => (
              <li key={i}>
                <CourseCardSkeleton />
              </li>
            ))}
          </ul>
        ) : courses.length === 0 ? (
          <div className="kolam flex flex-col items-start gap-3 rounded-2xl border border-(--color-line) p-8">
            <p className="text-xl">No courses match{q.trim() ? ` “${q.trim()}”` : ""}.</p>
            <p className="text-(--color-mist)">Try a shorter search, a professor&apos;s surname, or another subject.</p>
            {filtered && (
              <button type="button" onClick={clear} className="min-h-10 rounded-full bg-(--color-signal) px-5 text-white">
                Clear search and filters
              </button>
            )}
          </div>
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => (
                <li key={c.id} className="rise">
                  <CourseCard course={c} />
                </li>
              ))}
            </ul>
            {nextCursor && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="tile inline-flex min-h-12 items-center gap-2 rounded-full border border-(--color-line) bg-(--color-node) px-6 hover:border-(--color-signal) disabled:opacity-60"
                >
                  {loadingMore && <Loader2 size={16} className="animate-spin" aria-hidden />}
                  {loadingMore ? "Loading" : "Show more courses"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
