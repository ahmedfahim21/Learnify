import { z } from "zod";

import { COURSE_PAGE_SIZE, listCourses, toCourseDto } from "@/lib/courses/repo";

export const runtime = "nodejs";

const query = z.object({
  discipline: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(100).optional(),
  cursor: z.coerce.number().int().positive().optional(),
});

/** Browse the video courses in the bank. Public: it's NPTEL's own catalogue. */
export async function GET(request: Request): Promise<Response> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = query.safeParse(params);
  if (!parsed.success) {
    return Response.json({ error: "Invalid query", issues: parsed.error.issues }, { status: 400 });
  }
  const { discipline, q, cursor } = parsed.data;
  const page = await listCourses({ disciplineId: discipline, q: q || undefined, cursor, limit: COURSE_PAGE_SIZE });
  return Response.json({ courses: page.courses.map(toCourseDto), nextCursor: page.nextCursor });
}
