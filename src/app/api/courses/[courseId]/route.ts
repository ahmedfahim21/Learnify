import { getCourseWithLectures, NOT_READY, studyReadiness, toCourseDto, toLectureDto } from "@/lib/courses/repo";
import { NptelFetchError } from "@/lib/nptel/client";
import { NptelFormatError } from "@/lib/nptel/decode";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ courseId: string }> };

/**
 * A course and its lectures. The first request for a course fetches its
 * outline from NPTEL; later ones read Postgres. Public, like the catalogue.
 */
export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { courseId: raw } = await context.params;
  const courseId = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(courseId)) {
    return Response.json({ error: "Course id must be a number." }, { status: 400 });
  }

  try {
    const result = await getCourseWithLectures(courseId);
    if (!result) return Response.json({ error: "No such course." }, { status: 404 });
    const ready = await studyReadiness(result.lectures.map((l) => l.id));
    return Response.json({
      course: toCourseDto(result.course, result.lectures.length),
      lectures: result.lectures.map((l) => toLectureDto(l, ready.get(l.id) ?? NOT_READY)),
    });
  } catch (err) {
    // NPTEL being down or changing its format isn't our 500: say whose it is.
    if (err instanceof NptelFetchError || err instanceof NptelFormatError) {
      console.error(`course ${courseId} outline:`, err.message);
      return Response.json({ error: "Couldn't load this course from NPTEL right now.", detail: err.message }, { status: 502 });
    }
    throw err;
  }
}
