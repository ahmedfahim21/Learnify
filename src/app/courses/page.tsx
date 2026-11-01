"use client";

import { ChevronDown, GraduationCap, Loader2, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { CourseCard, CourseCardSkeleton, disciplineColour } from "@/components/courses/CourseCard";
import { subjectIcon } from "@/components/courses/subjects";
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
          {total ? `${total.toLocaleString("en-IN")} NPTEL video courses` : "NPTEL video courses"} from over 100 Indian institutes, the IITs and IISc among them.
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
          <SubjectFilter disciplines={disciplines} total={total ?? 0} value={discipline} onChange={setDiscipline} />
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
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>li]:min-w-0">
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
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>li]:min-w-0">
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

/** Subjects shown before "More": the largest, plus whichever one is picked. */
const TOP = 7;

/**
 * Subjects as chips that wrap rather than scroll sideways: the largest few,
 * then "More subjects" opens every one in a grid. Picking one closes it.
 */
function SubjectFilter({
  disciplines,
  total,
  value,
  onChange,
}: {
  disciplines: Discipline[] | null;
  total: number;
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  if (disciplines === null) {
    return (
      <div className="flex flex-wrap gap-2" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className="h-9 w-32 animate-pulse rounded-full bg-(--color-raised)" />
        ))}
      </div>
    );
  }
  const top = disciplines.slice(0, TOP);
  const picked = disciplines.find((d) => d.id === value);
  const shown = picked && !top.includes(picked) ? [...top, picked] : top;
  const pick = (id: number | null) => {
    onChange(id);
    setOpen(false);
  };

  const chip = (d: { id: number | null; name: string; courses: number }) => {
    const on = value === d.id;
    // On phones only "All" and the current pick stay out; the rest live under "More".
    const phoneHidden = d.id !== null && !on;
    const colour = d.id === null ? "var(--color-fg)" : disciplineColour(d.id);
    const Icon = d.id === null ? GraduationCap : subjectIcon(d.name);
    return (
      <button
        key={d.id ?? "all"}
        type="button"
        aria-pressed={on}
        onClick={() => pick(d.id)}
        className={`inline-flex min-h-10 items-center gap-2 rounded-full border py-1 pr-3.5 pl-1.5 text-sm transition-colors ${phoneHidden ? "max-sm:hidden" : ""}`}
        style={{
          borderColor: on ? colour : "var(--color-line)",
          background: on ? colour : "var(--color-node)",
          color: on ? "white" : "var(--color-fg)",
        }}
      >
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-full"
          style={{ background: on ? "rgba(255,255,255,0.2)" : `color-mix(in srgb, ${colour} 12%, transparent)`, color: on ? "white" : colour }}
        >
          <Icon size={14} />
        </span>
        <span className="text-left">{d.name}</span>
        <span className="font-mono text-xs opacity-70">{d.courses}</span>
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div role="toolbar" aria-label="Filter by subject" className="flex flex-wrap gap-2">
        {chip({ id: null, name: "All", courses: total })}
        {shown.map(chip)}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="all-subjects"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm text-(--color-signal) hover:bg-(--color-signal)/[0.06]"
        >
          {open ? "Fewer" : (
            <>
              <span className="sm:hidden">All {disciplines.length} subjects</span>
              <span className="max-sm:hidden">More subjects ({disciplines.length - shown.length})</span>
            </>
          )}
          <ChevronDown size={15} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        <div id="all-subjects" className="rise grid max-h-[50vh] gap-2 overflow-y-auto rounded-2xl border border-(--color-line) bg-(--color-surface) p-3 sm:grid-cols-2 lg:grid-cols-3">
          {disciplines.map((d) => {
            const Icon = subjectIcon(d.name);
            const colour = disciplineColour(d.id);
            const on = value === d.id;
            return (
              <button
                key={d.id}
                type="button"
                aria-pressed={on}
                onClick={() => pick(d.id)}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors ${on ? "bg-(--color-node) ring-2 ring-(--color-signal)" : "hover:bg-(--color-node)"}`}
              >
                <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: colour }}>
                  <Icon size={15} />
                </span>
                <span className="flex-1">{d.name}</span>
                <span className="font-mono text-xs text-(--color-faint)">{d.courses}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
