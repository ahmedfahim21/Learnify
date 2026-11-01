"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, Play, VideoOff } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { courseTitle, disciplineColour, InstituteBadge, SubjectIcon } from "@/components/courses/CourseCard";
import type { CourseDto, LectureDto } from "@/lib/courses/repo";
import { LANGUAGES, type Lang } from "@/lib/languages";

/** A course's lectures, grouped by week. Reads /api/courses/[courseId]. */
export default function CoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [data, setData] = useState<{ course: CourseDto; lectures: LectureDto[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/courses/${courseId}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.detail ?? body.error ?? `HTTP ${res.status}`);
        setData(body);
      })
      .catch((err: Error) => {
        console.error("loading the course failed:", err);
        setError(err.message);
      });
  }, [courseId]);

  if (error) {
    return (
      <main className="wrap space-y-4 py-12">
        <Link href="/courses" className="label inline-flex items-center gap-1.5 hover:text-(--color-fg)">
          <ArrowLeft size={14} aria-hidden /> Courses
        </Link>
        <p role="alert" className="text-(--color-alert)">
          Couldn&apos;t load this course: {error}
        </p>
      </main>
    );
  }
  if (!data) return <CourseSkeleton />;

  const { course, lectures } = data;
  const colour = disciplineColour(course.disciplineId);
  const units = [...Map.groupBy(lectures, (l) => l.unitName)];
  const first = lectures.find((l) => l.youtubeId);
  const readyLectures = lectures.filter((l) => l.ready.notes.length || l.ready.quiz.length).length;
  const readyLangs = [...new Set(lectures.flatMap((l) => [...l.ready.notes, ...l.ready.quiz]))];
  const professors = course.professor.split(/,\s*/).map((p) => p.replace(/\s+/g, " ").trim());

  return (
    <main className="pb-12">
      <header className="border-b border-(--color-line) bg-(--color-surface)">
        <div className="wrap space-y-5 py-10">
          <Link href="/courses" className="label inline-flex items-center gap-1.5 hover:text-(--color-fg)">
            <ArrowLeft size={14} aria-hidden /> Courses
          </Link>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <p className="flex items-center gap-2 font-mono text-xs tracking-wide text-(--color-mist) uppercase">
                <SubjectIcon name={course.disciplineName} colour={colour} size={26} />
                {course.disciplineName}
              </p>
              <h1 className="text-4xl tracking-tight sm:text-5xl">{courseTitle(course.title)}</h1>
              <div className="flex items-center gap-3">
                <InstituteBadge institute={course.institute} colour={colour} size={48} />
                <span className="leading-tight">
                  <span className="block">{professors.join(", ")}</span>
                  <span className="block text-sm text-(--color-mist)">{course.institute} · NPTEL</span>
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <span className="font-mono text-sm text-(--color-mist)">
                {lectures.length} lectures · {units.length} {units.length === 1 ? "unit" : "units"}
              </span>
              {first && (
                <Link
                  href={`/lecture/${first.id}`}
                  className="tile inline-flex min-h-12 items-center gap-2 rounded-full bg-(--color-signal) px-6 text-white"
                >
                  <Play size={16} aria-hidden /> Start lecture {first.position + 1}
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="wrap space-y-10 pt-10">
        {readyLectures > 0 && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-(--color-deep)/[0.07] px-4 py-3 text-(--color-deep)">
            <CheckCircle2 size={16} aria-hidden />
            {readyLectures} {readyLectures === 1 ? "lecture has" : "lectures have"} notes or quizzes ready in
            <ReadyLangs langs={readyLangs} />
            <span className="text-(--color-mist)">· they open instantly</span>
          </p>
        )}
        {units.map(([unit, unitLectures]) => (
          <section key={unit} className="space-y-4" aria-labelledby={`unit-${unitLectures[0].id}`}>
            <div className="flex items-baseline justify-between gap-3 border-b border-(--color-line) pb-2">
              <h2 id={`unit-${unitLectures[0].id}`} className="text-2xl">
                {unit}
              </h2>
              <span className="font-mono text-sm text-(--color-faint)">{unitLectures.length}</span>
            </div>
            <ol className="grid gap-3 lg:grid-cols-2 [&>*]:min-w-0">
              {unitLectures.map((l) => (
                <li key={l.id}>
                  <LectureRow lecture={l} />
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </main>
  );
}

function LectureRow({ lecture }: { lecture: LectureDto }) {
  const thumb = (
    <span className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-xl bg-(--color-raised) sm:w-36">
      {lecture.youtubeId ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnails; next/image would need a remote pattern */}
          <img
            src={`https://i.ytimg.com/vi/${lecture.youtubeId}/mqdefault.jpg`}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
            <span className="flex h-8 w-8 scale-90 items-center justify-center rounded-full bg-white/95 text-(--color-signal) opacity-0 transition group-hover:scale-100 group-hover:opacity-100">
              <Play size={14} className="translate-x-px" aria-hidden />
            </span>
          </span>
        </>
      ) : (
        <span className="flex h-full items-center justify-center text-(--color-faint)">
          <VideoOff size={18} aria-hidden />
        </span>
      )}
    </span>
  );
  const body = (
    <span className="min-w-0 flex-1 space-y-1">
      <span className="block font-mono text-xs text-(--color-faint)">Lecture {lecture.position + 1}</span>
      <span className="line-clamp-2 block leading-snug">{lecture.title}</span>
      {!lecture.youtubeId && <span className="block text-sm text-(--color-faint)">No video on NPTEL</span>}
      {(lecture.ready.notes.length > 0 || lecture.ready.quiz.length > 0) && (
        <span className="flex flex-wrap items-center gap-x-1.5 text-sm text-(--color-deep)">
          <CheckCircle2 size={13} aria-hidden />
          {[lecture.ready.notes.length ? "Notes" : null, lecture.ready.quiz.length ? "Quiz" : null].filter(Boolean).join(" · ")}
          <ReadyLangs langs={[...new Set([...lecture.ready.notes, ...lecture.ready.quiz])]} />
        </span>
      )}
    </span>
  );

  if (!lecture.youtubeId) {
    return (
      <div aria-disabled className="flex items-center gap-4 rounded-2xl border border-dashed border-(--color-line) p-3 text-(--color-mist)">
        {thumb}
        {body}
      </div>
    );
  }
  return (
    <Link
      href={`/lecture/${lecture.id}`}
      className="tile group flex items-center gap-4 rounded-2xl border border-(--color-line) bg-(--color-node) p-3 hover:border-(--color-signal)"
    >
      {thumb}
      {body}
      <ArrowRight size={16} className="shrink-0 text-(--color-faint) transition-transform group-hover:translate-x-0.5 group-hover:text-(--color-signal)" aria-hidden />
    </Link>
  );
}

function ReadyLangs({ langs }: { langs: Lang[] }) {
  return (
    <>
      {langs.map((l, i) => (
        <span key={l} lang={LANGUAGES[l].sarvam}>
          {LANGUAGES[l].native}
          {i < langs.length - 1 ? "," : ""}
        </span>
      ))}
    </>
  );
}

function CourseSkeleton() {
  return (
    <main className="pb-12" aria-busy>
      <div className="border-b border-(--color-line) bg-(--color-surface)">
        <div className="wrap space-y-4 py-10">
          <div className="h-4 w-20 animate-pulse rounded bg-(--color-raised)" />
          <div className="h-12 w-2/3 animate-pulse rounded-xl bg-(--color-raised)" />
          <div className="h-10 w-64 animate-pulse rounded-xl bg-(--color-raised)" />
        </div>
      </div>
      <div className="wrap space-y-4 pt-10">
        <p className="text-(--color-mist)">Fetching lectures from NPTEL…</p>
        <div className="grid gap-3 lg:grid-cols-2 [&>*]:min-w-0">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-(--color-raised)" />
          ))}
        </div>
      </div>
    </main>
  );
}
