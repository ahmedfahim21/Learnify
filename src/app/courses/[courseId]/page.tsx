"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import type { CourseDto, LectureDto } from "@/lib/courses/repo";

/** A course's lectures, grouped by unit. Reads /api/courses/[courseId]. */
export default function CoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [data, setData] = useState<{ course: CourseDto; lectures: LectureDto[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/courses/${courseId}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.detail ?? body.error ?? `HTTP ${res.status}`);
        setData(body);
      })
      .catch((err: Error) => setError(err.message));
  }, [courseId]);

  if (error) return <main className="wrap py-12 text-(--color-alert)">{error}</main>;
  if (!data) {
    return (
      <main className="wrap space-y-3 py-12">
        <div className="h-8 w-2/3 animate-pulse rounded-(--radius) bg-(--color-raised)" />
        <p className="text-(--color-mist)">Loading lectures from NPTEL…</p>
      </main>
    );
  }

  const units = Map.groupBy(data.lectures, (l) => l.unitName);
  return (
    <main className="wrap space-y-8 py-12">
      <div className="space-y-2">
        <Link href="/courses" className="label hover:text-(--color-fg)">
          ← Courses
        </Link>
        <h1 className="text-3xl">{data.course.title.replace(/^NOC:/, "")}</h1>
        <p className="text-(--color-mist)">
          {data.course.professor} · {data.course.institute}
        </p>
      </div>
      {[...units].map(([unit, lectures]) => (
        <section key={unit} className="space-y-2">
          <h2 className="label">{unit}</h2>
          <ul className="divide-y divide-(--color-line) border-y border-(--color-line)">
            {lectures.map((l) => (
              <li key={l.id}>
                {l.youtubeId ? (
                  <Link href={`/lecture/${l.id}`} className="flex justify-between gap-4 py-3 hover:text-(--color-signal)">
                    <span>{l.title}</span>
                    <span className="label shrink-0">{l.captionLangs.join(" ")}</span>
                  </Link>
                ) : (
                  <span className="block py-3 text-(--color-faint)">{l.title} (no video)</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
