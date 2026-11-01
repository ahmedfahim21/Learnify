"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CourseCard, CourseCardSkeleton } from "@/components/courses/CourseCard";
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
    <section className="wrap space-y-8" aria-labelledby="featured-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <p className="eyebrow">Start here</p>
          <h2 id="featured-heading" className="text-4xl tracking-[-0.03em] sm:text-5xl">
            Lectures ready to open
          </h2>
        </div>
        <Link href="/courses" className="btn btn-secondary">
          All courses →
        </Link>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>li]:min-w-0">
        {courses === null
          ? Array.from({ length: SHOWN }, (_, i) => (
              <li key={i}>
                <CourseCardSkeleton />
              </li>
            ))
          : courses.slice(0, SHOWN).map((c) => (
              <li key={c.id}>
                <CourseCard course={c} />
              </li>
            ))}
      </ul>
    </section>
  );
}
