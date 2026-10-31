"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { CourseDto } from "@/lib/courses/repo";

/**
 * The landing page's featured courses (GET /api/courses?featured=1): chosen
 * by rule for full English captions, with their first lectures already
 * prepared. Renders nothing if no shelf is set.
 */
/** Enough to pick from without turning the landing page into the catalogue. */
const SHOWN = 6;

export function FeaturedShelf() {
  const [courses, setCourses] = useState<CourseDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/courses?featured=1")
      .then(async (res) => {
        // A crashed route answers 500 with an empty body; report the status, not a JSON parse error.
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `/api/courses?featured=1 → HTTP ${res.status}`);
        setCourses(body.courses);
      })
      .catch((err: Error) => {
        console.error("loading the featured shelf failed:", err);
        setError(err.message);
      });
  }, []);

  if (error || courses?.length === 0) return null;

  return (
    <section className="wrap space-y-5" aria-labelledby="featured-heading">
      <div className="flex items-end justify-between gap-4">
        <h2 id="featured-heading" className="text-3xl">
          Start with one of these
        </h2>
        <Link href="/courses" className="text-sm text-(--color-signal)">
          All courses →
        </Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {courses === null
          ? Array.from({ length: 6 }, (_, i) => <li key={i} className="h-32 animate-pulse rounded-2xl bg-(--color-raised)" />)
          : courses.slice(0, SHOWN).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/courses/${c.id}`}
                  className="tile flex h-full flex-col gap-1 rounded-2xl border border-(--color-line) bg-(--color-node) p-5 hover:border-(--color-signal)"
                >
                  <p className="label">{c.disciplineName}</p>
                  <p className="text-lg leading-snug">{c.title.replace(/^NOC:\s*/, "")}</p>
                  <p className="mt-auto pt-2 text-sm text-(--color-mist)">
                    {c.professor} · {c.institute}
                  </p>
                </Link>
              </li>
            ))}
      </ul>
    </section>
  );
}
