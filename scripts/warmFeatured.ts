/**
 * Pick the landing page's featured shelf by rule and pre-build its first
 * lectures, so a first visit is instant instead of a minute of "preparing".
 *
 *   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/warmFeatured.ts
 *
 * Candidates are the first CANDIDATES_PER_DISCIPLINE video courses in each
 * starter discipline. Each candidate's outline is fetched (and stored, as a
 * first visit would), scored with scoreForShelf, and the best SHELF_SIZE
 * eligible courses get a featured_rank. Their first WARM_LECTURES lectures
 * are prepared in English plus up to WARM_EXTRA_LANGS languages NPTEL has
 * human subtitles for (each language's study pack is a translation, and
 * warming all of them would run into Sarvam's rate limit).
 * Safe to re-run: stored outlines, subtitles and packs are reused.
 */
import { and, asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { courses } from "@/db/schema";
import { getCourseWithLectures, scoreForShelf, setFeatured, STARTER_DISCIPLINES } from "@/lib/courses/repo";
import { runStages } from "@/lib/jobs/prepare";
import type { Lang } from "@/lib/languages";
import { fetchCourseOutline } from "@/lib/nptel/client";

const CANDIDATES_PER_DISCIPLINE = 12;
const SHELF_SIZE = 12;
const WARM_LECTURES = 3;
/** Human-subtitle languages warmed per course besides English; the rest build on first open. */
const WARM_EXTRA_LANGS = 2;

async function main() {
  const db = getDb();
  const scored: { id: number; title: string; score: number; langs: Lang[] }[] = [];

  for (const disciplineId of STARTER_DISCIPLINES) {
    const candidates = await db
      .select({ id: courses.id, title: courses.title })
      .from(courses)
      .where(and(eq(courses.disciplineId, disciplineId), eq(courses.contentType, "Video")))
      .orderBy(asc(courses.id))
      .limit(CANDIDATES_PER_DISCIPLINE);
    for (const c of candidates) {
      try {
        const outline = await fetchCourseOutline(c.id);
        const s = scoreForShelf(disciplineId, outline.lessons);
        if (s.eligible) scored.push({ id: c.id, title: c.title, score: s.score, langs: s.humanLangs });
      } catch (err) {
        console.warn(`skipping ${c.id}: ${err instanceof Error ? err.message : err}`);
      }
    }
    console.log(`discipline ${disciplineId}: ${scored.length} eligible so far`);
  }

  const shelf = scored.sort((a, b) => b.score - a.score || a.id - b.id).slice(0, SHELF_SIZE);
  await setFeatured(shelf.map((c) => c.id));
  console.log("Featured shelf:");
  for (const [n, c] of shelf.entries()) console.log(`  ${n + 1}. ${c.title} [${c.langs.join(", ") || "English only"}]`);

  for (const c of shelf) {
    const course = await getCourseWithLectures(c.id);
    const lectures = (course?.lectures ?? []).filter((l) => l.youtubeId).slice(0, WARM_LECTURES);
    for (const lecture of lectures) {
      for (const lang of ["en", ...c.langs.slice(0, WARM_EXTRA_LANGS)] as Lang[]) {
        // runStages stops at its time budget; keep calling until the lecture is done or stuck.
        for (let round = 0; round < 4; round++) {
          const report = await runStages(lecture.id, lang);
          if (!report.stoppedAt) break;
          if (report.stoppedAt.reason !== "budget") {
            console.warn(`  ${c.title} / ${lecture.title} / ${lang}: stopped (${report.stoppedAt.reason}) ${report.stoppedAt.detail ?? ""}`);
            break;
          }
        }
      }
      console.log(`  warmed ${c.title} / ${lecture.title}`);
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
