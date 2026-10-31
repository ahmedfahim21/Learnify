import { count, eq } from "drizzle-orm";
import type { Metadata } from "next";

import { getDb } from "@/db";
import { courses, lectures } from "@/db/schema";

/**
 * Titles and descriptions for shared links to a course or a lecture. Read
 * straight from Postgres (never NPTEL), so building a preview costs one query.
 * Unknown ids get no extra metadata and fall back to the site's own.
 */

const courseTitle = (title: string) => title.replace(/^NOC:\s*/, "");
/** Setting openGraph replaces the site's whole object, image included, so the card is named again here. */
const IMAGE = [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Learnify: watch an NPTEL lecture, learn it in your language" }];

const LEARN = "Notes, quizzes and flashcards written from it in Hindi, Tamil, Telugu, Bengali and more.";

export async function courseMetadata(rawId: string): Promise<Metadata> {
  const id = Number(rawId);
  if (!/^\d+$/.test(rawId) || !Number.isSafeInteger(id)) return {};
  const db = getDb();
  const [course] = await db.select().from(courses).where(eq(courses.id, id));
  if (!course) return {};
  const [{ n }] = await db.select({ n: count() }).from(lectures).where(eq(lectures.courseId, id));
  const title = courseTitle(course.title);
  const description = `${n ? `${n} lectures by` : "By"} ${course.professor.replace(/\s+/g, " ")}, ${course.institute}. ${LEARN}`;
  return { title, description, openGraph: { title, description, images: IMAGE }, twitter: { card: "summary_large_image", title, description, images: IMAGE } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function lectureMetadata(lectureId: string): Promise<Metadata> {
  if (!UUID.test(lectureId)) return {};
  const [row] = await getDb()
    .select({ title: lectures.title, course: courses.title, institute: courses.institute, professor: courses.professor })
    .from(lectures)
    .innerJoin(courses, eq(courses.id, lectures.courseId))
    .where(eq(lectures.id, lectureId));
  if (!row) return {};
  const title = `${row.title} · ${courseTitle(row.course)}`;
  const description = `An NPTEL lecture by ${row.professor.replace(/\s+/g, " ")}, ${row.institute}. ${LEARN}`;
  return { title, description, openGraph: { title, description, images: IMAGE }, twitter: { card: "summary_large_image", title, description, images: IMAGE } };
}
