/**
 * Mirror NPTEL's course list into the `courses` table. Safe to re-run: it
 * upserts by NPTEL course id and leaves each course's lecture outline alone.
 *
 *   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/nptelSync.ts
 */
import { syncCourseList } from "@/lib/courses/repo";
import { fetchCourseList } from "@/lib/nptel/client";

async function main() {
  const list = await fetchCourseList();
  const video = list.courses.filter((c) => c.contentType === "Video").length;
  const count = await syncCourseList(list);
  console.log(`Synced ${count} NPTEL courses (${video} video) across ${list.disciplines.length} disciplines.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
