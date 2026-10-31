"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { CourseDto } from "@/lib/courses/repo";
import { LANGUAGES, type Lang } from "@/lib/languages";

/**
 * The landing page's featured courses (GET /api/courses?featured=1): chosen
 * by rule for full English captions and human Indic subtitles, with their
 * first lectures already prepared. Renders nothing if no shelf is set.
 */
export function FeaturedShelf() {
  const [courses, setCourses] = useState<CourseDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/courses?featured=1")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
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
        <h2 id="featured-heading" className="label shirorekha">
          Start here · ready to watch
        </h2>
        <Link href="/courses" className="text-sm text-(--color-signal)">
          All courses →
        </Link>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {courses === null
          ? Array.from({ length: 6 }, (_, i) => <li key={i} className="h-36 animate-pulse rounded-(--radius) bg-(--color-raised)" />)
          : courses.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/courses/${c.id}`}
                  className="flex h-full flex-col justify-between gap-4 rounded-(--radius) border border-(--color-line) bg-(--color-surface) p-4 transition-colors hover:border-(--color-signal)"
                >
                  <div className="space-y-1">
                    <p className="label">{c.disciplineName}</p>
                    <p className="text-lg leading-snug">{c.title.replace(/^NOC:\s*/, "")}</p>
                    <p className="text-sm text-(--color-mist)">
                      {c.professor} · {c.institute}
                    </p>
                  </div>
                  {c.humanLangs && c.humanLangs.length > 0 && (
                    <p className="flex flex-wrap gap-x-2 text-sm text-(--color-deep)">
                      {c.humanLangs.map((l) => (
                        <span key={l} lang={LANGUAGES[l as Lang]?.sarvam}>
                          {LANGUAGES[l as Lang]?.native ?? l}
                        </span>
                      ))}
                    </p>
                  )}
                </Link>
              </li>
            ))}
      </ul>
    </section>
  );
}
