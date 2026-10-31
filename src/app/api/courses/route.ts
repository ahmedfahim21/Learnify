import { z } from "zod";

import { COURSE_PAGE_SIZE, listCourses, listDisciplines, listFeatured, toCourseDto } from "@/lib/courses/repo";

export const runtime = "nodejs";

const query = z.object({
  discipline: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(100).optional(),
  cursor: z.coerce.number().int().positive().optional(),
  featured: z.enum(["1"]).optional(),
});

/**
 * Browse the video courses in the bank. Public: it's NPTEL's own catalogue.
 * The first page also carries the disciplines, for the filter.
 */
export async function GET(request: Request): Promise<Response> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = query.safeParse(params);
  if (!parsed.success) {
    return Response.json({ error: "Invalid query", issues: parsed.error.issues }, { status: 400 });
  }
  const { discipline, q, cursor, featured } = parsed.data;
  if (featured) {
    return Response.json(
      { courses: (await listFeatured()).map(toCourseDto) },
      { headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=86400" } },
    );
  }
  const [page, disciplines] = await Promise.all([
    listCourses({ disciplineId: discipline, q: q || undefined, cursor, limit: COURSE_PAGE_SIZE }),
    // The filter chips only need the list once, with the first page.
    cursor === undefined ? listDisciplines() : null,
  ]);
  return Response.json({
    courses: page.courses.map(toCourseDto),
    nextCursor: page.nextCursor,
    ...(disciplines ? { disciplines } : {}),
  });
}
