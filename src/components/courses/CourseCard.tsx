import Link from "next/link";

import { instituteLogo } from "@/lib/courses/institutes";
import type { CourseDto } from "@/lib/courses/repo";

/**
 * A course in a list: its subject (colour-coded), title, and who teaches it
 * where. Used by the catalogue and the landing page's shelf.
 */

const COLOURS = ["var(--color-signal)", "var(--color-accent)", "var(--color-deep)", "var(--color-flow)", "var(--color-warn)", "var(--color-alert)"];

/** A stable accent per discipline, so a subject keeps its colour everywhere. */
export function disciplineColour(disciplineId: number): string {
  return COLOURS[Math.abs(disciplineId) % COLOURS.length];
}

/** "IIT Madras" → "IITM", "IISc Bangalore" → "IISc"; anything else, its initials. */
export function instituteShort(institute: string): string {
  const name = institute.trim();
  const iit = /^IIT\s+(\w)/i.exec(name);
  if (iit) return `IIT${iit[1].toUpperCase()}`;
  if (/^IISc/i.test(name)) return "IISc";
  const initials = name
    .split(/[\s,]+/)
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .join("");
  return initials.slice(0, 4) || name.slice(0, 3);
}

/** The institute's logo on white, or its monogram in the subject colour when there's no logo. */
export function InstituteBadge({ institute, colour, size = 32 }: { institute: string; colour: string; size?: number }) {
  const logo = instituteLogo(institute);
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- small static PNGs; next/image adds nothing here
      <img
        src={logo}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className="shrink-0 rounded-lg border border-(--color-line) bg-white object-contain p-0.5"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-lg px-1.5 font-mono text-[0.7rem] text-white"
      style={{ background: colour, height: size, minWidth: size }}
    >
      {instituteShort(institute)}
    </span>
  );
}

export const courseTitle = (title: string) => title.replace(/^NOC:\s*/, "");

export function CourseCard({ course }: { course: CourseDto }) {
  const colour = disciplineColour(course.disciplineId);
  return (
    <Link
      href={`/courses/${course.id}`}
      className="tile group flex h-full flex-col gap-3 rounded-2xl border border-(--color-line) bg-(--color-node) p-5 hover:border-(--color-signal)"
    >
      <span className="flex items-center gap-2 text-xs tracking-wide text-(--color-mist) uppercase">
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: colour }} />
        <span className="truncate font-mono">{course.disciplineName}</span>
        {course.lectureCount !== null && (
          <span className="ml-auto shrink-0 font-mono normal-case">{course.lectureCount} lectures</span>
        )}
      </span>
      <span className="line-clamp-3 text-lg leading-snug group-hover:text-(--color-signal)">{courseTitle(course.title)}</span>
      <span className="mt-auto flex items-center gap-2.5 pt-1">
        <InstituteBadge institute={course.institute} colour={colour} size={36} />
        <span className="min-w-0 text-sm leading-tight">
          <span className="block truncate">{course.professor}</span>
          <span className="block truncate text-(--color-mist)">{course.institute}</span>
        </span>
      </span>
    </Link>
  );
}

export function CourseCardSkeleton() {
  return <div className="h-44 animate-pulse rounded-2xl bg-(--color-raised)" />;
}
