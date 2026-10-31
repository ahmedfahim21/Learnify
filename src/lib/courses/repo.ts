import { and, asc, count, eq, gt, ilike, isNotNull, or, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { type Course, courses, type Lecture, lectures, type NewCourse, type NewLecture } from "@/db/schema";
import { type Lang, LANGUAGES } from "@/lib/languages";
import { fetchCourseOutline } from "@/lib/nptel/client";
import type { NptelCourseList, NptelLesson } from "@/lib/nptel/decode";

/**
 * The course bank in Postgres. The full course list is mirrored by
 * scripts/nptelSync.ts; a course's lectures are fetched from NPTEL the first
 * time anyone opens it, then served from the database for everyone after.
 */

// --- Pure mapping (tested directly) -----------------------------------------

export function toCourseRows(list: NptelCourseList, now: Date = new Date()): NewCourse[] {
  const disciplines = new Map(list.disciplines.map((d) => [Number(d.id), d.name.replace(/\s+/g, " ").trim()]));
  return list.courses.map((c) => {
    const disciplineName = disciplines.get(c.disciplineId);
    if (!disciplineName) throw new Error(`course ${c.id} has unknown discipline ${c.disciplineId}`);
    return {
      id: c.id,
      title: c.title.trim(),
      professor: c.professor.replace(/\s+/g, " ").trim(),
      institute: c.instituteName.trim(),
      disciplineId: c.disciplineId,
      disciplineName,
      contentType: c.contentType,
      syncedAt: now,
    };
  });
}

/** Indic languages NPTEL has human subtitles for, on at least half the playable lectures. */
export function humanLangsOf(lessons: NptelLesson[]): Lang[] {
  const playable = lessons.filter((l) => l.youtubeId);
  if (playable.length === 0) return [];
  return (Object.keys(LANGUAGES) as Lang[]).filter((code) => {
    if (code === "en") return false;
    const name = LANGUAGES[code].nptelName;
    const withTrack = playable.filter((l) => l.vttIds[name]).length;
    return withTrack * 2 >= playable.length;
  });
}

export function toLectureRows(courseId: number, lessons: NptelLesson[]): NewLecture[] {
  return lessons.map((l, position) => ({
    courseId,
    position,
    nptelLessonId: l.id,
    unitName: l.unitName,
    title: l.title,
    youtubeId: l.youtubeId,
    conceptsCovered: l.conceptsCovered,
    vttRefs: l.vttIds,
  }));
}

// --- Database ---------------------------------------------------------------

const UPSERT_CHUNK = 500;

/** Upsert the whole NPTEL list. Outline state (`humanLangs`, `outlineFetchedAt`) is left alone. */
export async function syncCourseList(list: NptelCourseList): Promise<number> {
  const rows = toCourseRows(list);
  const db = getDb();
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    await db
      .insert(courses)
      .values(rows.slice(i, i + UPSERT_CHUNK))
      .onConflictDoUpdate({
        target: courses.id,
        set: {
          title: sql`excluded.title`,
          professor: sql`excluded.professor`,
          institute: sql`excluded.institute`,
          disciplineId: sql`excluded.discipline_id`,
          disciplineName: sql`excluded.discipline_name`,
          contentType: sql`excluded.content_type`,
          syncedAt: sql`excluded.synced_at`,
        },
      });
  }
  return rows.length;
}

export interface CourseWithLectures {
  course: Course;
  lectures: Lecture[];
}

/**
 * A course and its lectures, fetching the outline from NPTEL on first open.
 * Two first opens at once both upsert the same rows, which is harmless.
 * Returns null for an id that isn't in the course bank.
 */
export async function getCourseWithLectures(courseId: number): Promise<CourseWithLectures | null> {
  const db = getDb();
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
  if (!course) return null;

  if (!course.outlineFetchedAt) {
    const outline = await fetchCourseOutline(courseId);
    const rows = toLectureRows(courseId, outline.lessons);
    const humanLangs = humanLangsOf(outline.lessons);
    await db.transaction(async (tx) => {
      if (rows.length > 0) {
        await tx
          .insert(lectures)
          .values(rows)
          .onConflictDoUpdate({
            target: [lectures.courseId, lectures.position],
            set: {
              nptelLessonId: sql`excluded.nptel_lesson_id`,
              unitName: sql`excluded.unit_name`,
              title: sql`excluded.title`,
              youtubeId: sql`excluded.youtube_id`,
              conceptsCovered: sql`excluded.concepts_covered`,
              vttRefs: sql`excluded.vtt_refs`,
            },
          });
      }
      await tx
        .update(courses)
        .set({ humanLangs, outlineFetchedAt: new Date() })
        .where(eq(courses.id, courseId));
    });
    course.humanLangs = humanLangs;
    course.outlineFetchedAt = new Date();
  }

  const rows = await db
    .select()
    .from(lectures)
    .where(eq(lectures.courseId, courseId))
    .orderBy(asc(lectures.position));
  return { course, lectures: rows };
}

export const COURSE_PAGE_SIZE = 30;

// --- Featured shelf ----------------------------------------------------------

/** Disciplines a first visitor most likely wants: first-year basics, CS, maths, EE, physics. */
export const STARTER_DISCIPLINES = [122, 106, 111, 108, 115];

export interface FeatureScore {
  eligible: boolean;
  score: number;
  /** Share of lectures with both a video and NPTEL English captions. */
  coverage: number;
  humanLangs: Lang[];
}

/**
 * How good a first-visit course is. Eligible only if at least 90% of its
 * lectures have a video and English captions (no dead ends on the shelf).
 * Ranked by how many Indic languages have human subtitles, then by an
 * introductory title (and against a clearly advanced one), then by being in
 * a starter discipline.
 */
/** Titles a first visitor can start cold on, and titles that assume a degree's worth already. */
const INTRODUCTORY = /\b(introduct\w*|basic|basics|fundamentals?|elementary|programming|data structures|calculus|engineering mathematics|first course)\b/i;
const ADVANCED = /\b(advanced|quantum field|path integral|commutative algebra|algebraic geometry|topology|research|seminar)\b/i;

export function scoreForShelf(disciplineId: number, lessons: NptelLesson[], title = ""): FeatureScore {
  if (lessons.length === 0) return { eligible: false, score: 0, coverage: 0, humanLangs: [] };
  const playable = lessons.filter((l) => l.youtubeId && l.vttIds[LANGUAGES.en.nptelName]).length;
  const coverage = playable / lessons.length;
  const humanLangs = humanLangsOf(lessons);
  const starter = STARTER_DISCIPLINES.indexOf(disciplineId);
  const level = INTRODUCTORY.test(title) ? 6 : 0;
  const penalty = ADVANCED.test(title) ? 15 : 0;
  const score = humanLangs.length * 10 + (starter === -1 ? 0 : 5 - starter) + level - penalty;
  return { eligible: coverage >= 0.9, score, coverage, humanLangs };
}

export async function setFeatured(ranked: number[]): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.update(courses).set({ featuredRank: null }).where(isNotNull(courses.featuredRank));
    for (const [n, id] of ranked.entries()) {
      await tx.update(courses).set({ featuredRank: n + 1 }).where(eq(courses.id, id));
    }
  });
}

export async function listFeatured(): Promise<Course[]> {
  return getDb().select().from(courses).where(isNotNull(courses.featuredRank)).orderBy(asc(courses.featuredRank));
}

export interface Discipline {
  id: number;
  name: string;
  courses: number;
}

/** Disciplines with how many video courses each has, largest first. */
export async function listDisciplines(): Promise<Discipline[]> {
  const rows = await getDb()
    .select({ id: courses.disciplineId, name: courses.disciplineName, courses: count() })
    .from(courses)
    .where(eq(courses.contentType, "Video"))
    .groupBy(courses.disciplineId, courses.disciplineName)
    .orderBy(sql`count(*) desc`, asc(courses.disciplineName));
  return rows;
}

export interface ListCoursesQuery {
  disciplineId?: number;
  q?: string;
  /** The last course id of the previous page. */
  cursor?: number;
  limit: number;
}

export interface CoursePage {
  courses: Course[];
  nextCursor: number | null;
}

/** Browse video courses, optionally by discipline and a search over title, professor and institute. */
export async function listCourses({ disciplineId, q, cursor, limit }: ListCoursesQuery): Promise<CoursePage> {
  const term = q?.trim();
  const pattern = term ? `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  const rows = await getDb()
    .select()
    .from(courses)
    .where(
      and(
        eq(courses.contentType, "Video"),
        disciplineId === undefined ? undefined : eq(courses.disciplineId, disciplineId),
        cursor === undefined ? undefined : gt(courses.id, cursor),
        pattern
          ? or(
              ilike(courses.title, pattern),
              ilike(courses.professor, pattern),
              ilike(courses.institute, pattern),
            )
          : undefined,
      ),
    )
    .orderBy(asc(courses.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  return { courses: page, nextCursor: rows.length > limit ? page[page.length - 1].id : null };
}

// --- Response shapes --------------------------------------------------------
// What the browser gets. Caption references (Drive ids, gs:// paths) stay on
// the server: only the transcript pipeline fetches them.

export interface CourseDto {
  id: number;
  title: string;
  professor: string;
  institute: string;
  disciplineId: number;
  disciplineName: string;
  /** null until the course has been opened once and its outline fetched. */
  humanLangs: string[] | null;
}

export interface LectureDto {
  id: string;
  position: number;
  nptelLessonId: number;
  unitName: string;
  title: string;
  youtubeId: string | null;
  /** Language codes with an NPTEL human subtitle track for this lecture, English included. */
  captionLangs: Lang[];
}

export function toCourseDto(c: Course): CourseDto {
  return {
    id: c.id,
    title: c.title,
    professor: c.professor,
    institute: c.institute,
    disciplineId: c.disciplineId,
    disciplineName: c.disciplineName,
    humanLangs: c.humanLangs,
  };
}

export function toLectureDto(l: Lecture): LectureDto {
  return {
    id: l.id,
    position: l.position,
    nptelLessonId: l.nptelLessonId,
    unitName: l.unitName,
    title: l.title,
    youtubeId: l.youtubeId,
    captionLangs: (Object.keys(LANGUAGES) as Lang[]).filter((code) => l.vttRefs[LANGUAGES[code].nptelName]),
  };
}
