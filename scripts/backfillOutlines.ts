/**
 * Fetch every video course's lecture outline from NPTEL once, the way a first
 * visit would, so each course has a caption share and the catalogue can rank
 * courses by how much of them can be studied. Safe to re-run: it only picks
 * courses whose outline isn't fetched yet. No Sarvam calls.
 *
 *   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/backfillOutlines.ts
 *
 * A few requests at a time with a pause between, to stay polite to NPTEL.
 * Courses that fail are listed at the end and the script exits non-zero.
 */
import { and, asc, eq, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { courses } from "@/db/schema";
import { getCourseWithLectures } from "@/lib/courses/repo";

const CONCURRENCY = 3;
const PAUSE_MS = 400;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const todo = await getDb()
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.contentType, "Video"), isNull(courses.outlineFetchedAt)))
    .orderBy(asc(courses.id));
  console.log(`${todo.length} courses to fetch`);

  const failed: { id: number; error: string }[] = [];
  let done = 0;
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const { id } = todo[next++];
      try {
        await getCourseWithLectures(id);
      } catch (err) {
        failed.push({ id, error: err instanceof Error ? err.message : String(err) });
        console.error(`course ${id} failed:`, err instanceof Error ? err.message : err);
      }
      done++;
      if (done % 50 === 0) console.log(`${done}/${todo.length} (${failed.length} failed)`);
      await sleep(PAUSE_MS);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`Fetched ${done - failed.length} of ${todo.length}.`);
  if (failed.length > 0) {
    console.error(`${failed.length} failed:\n${failed.map((f) => `  ${f.id}: ${f.error}`).join("\n")}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
