"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { CourseDto, Discipline } from "@/lib/courses/repo";
import { LANGUAGES, type Lang } from "@/lib/languages";

/** Browse NPTEL video courses. Reads /api/courses; search is debounced. */
export default function CoursesPage() {
  const [q, setQ] = useState("");
  const [discipline, setDiscipline] = useState<number | null>(null);
  const [disciplines, setDisciplines] = useState<Discipline[] | null>(null);
  const [courses, setCourses] = useState<CourseDto[] | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(cursor?: number) {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (discipline !== null) params.set("discipline", String(discipline));
    if (cursor) params.set("cursor", String(cursor));
    const res = await fetch(`/api/courses?${params}`);
    if (!res.ok) throw new Error(`GET /api/courses → HTTP ${res.status}`);
    return (await res.json()) as { courses: CourseDto[]; nextCursor: number | null; disciplines?: Discipline[] };
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
        (err: Error) => setError(err.message),
      );
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when the query or filter changes
  }, [q, discipline]);

  return (
    <main className="wrap space-y-8 py-12">
      <div className="space-y-3">
        <p className="label">NPTEL courses</p>
        <h1 className="text-3xl">Pick a course</h1>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by title, professor or institute"
          className="min-h-11 w-full max-w-xl rounded-(--radius) border border-(--color-line) bg-(--color-surface) px-3"
        />
        <div role="toolbar" aria-label="Filter by discipline" className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1">
          {disciplines === null
            ? Array.from({ length: 8 }, (_, i) => (
                <span key={i} className="h-9 w-28 shrink-0 animate-pulse rounded-(--radius) bg-(--color-raised)" />
              ))
            : [{ id: null, name: "All", courses: null } as { id: number | null; name: string; courses: number | null }, ...disciplines].map((d) => (
                <button
                  key={d.id ?? "all"}
                  type="button"
                  aria-pressed={discipline === d.id}
                  onClick={() => setDiscipline(d.id)}
                  className={`min-h-9 shrink-0 rounded-(--radius) border px-3 text-sm transition-colors ${
                    discipline === d.id
                      ? "border-(--color-signal) bg-(--color-signal) text-white"
                      : "border-(--color-line) bg-(--color-surface) text-(--color-mist) hover:text-(--color-fg)"
                  }`}
                >
                  {d.name}
                  {d.courses !== null && <span className="ml-1.5 font-mono text-xs opacity-70">{d.courses}</span>}
                </button>
              ))}
        </div>
      </div>

      {error && <p className="text-(--color-alert)">{error}</p>}
      {!courses && !error && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="h-20 animate-pulse rounded-(--radius) bg-(--color-raised)" />
          ))}
        </ul>
      )}
      {courses?.length === 0 && <p className="text-(--color-mist)">No courses match.</p>}
      {courses && courses.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {courses.map((c) => (
            <li key={c.id}>
              <Link
                href={`/courses/${c.id}`}
                className="block h-full space-y-1 rounded-(--radius) border border-(--color-line) p-4 hover:border-(--color-faint)"
              >
                <p>{c.title.replace(/^NOC:/, "")}</p>
                <p className="text-sm text-(--color-mist)">
                  {c.professor} · {c.institute}
                </p>
                <p className="label">{c.disciplineName}</p>
                {c.humanLangs && c.humanLangs.length > 0 && (
                  <p className="flex flex-wrap items-center gap-1.5 pt-1 text-sm">
                    <span className="text-(--color-faint)">Human subtitles</span>
                    {c.humanLangs.map((l) => (
                      <span key={l} lang={LANGUAGES[l as Lang]?.sarvam} className="text-(--color-deep)">
                        {LANGUAGES[l as Lang]?.native ?? l}
                      </span>
                    ))}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {nextCursor && courses && (
        <button
          type="button"
          onClick={() =>
            load(nextCursor).then(
              (page) => {
                setCourses([...courses, ...page.courses]);
                setNextCursor(page.nextCursor);
              },
              (err: Error) => setError(err.message),
            )
          }
          className="border border-(--color-line) px-4 py-2 text-(--color-mist) hover:text-(--color-fg)"
        >
          Load more
        </button>
      )}
    </main>
  );
}
