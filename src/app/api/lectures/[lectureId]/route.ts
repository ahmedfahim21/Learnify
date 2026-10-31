import { getLectureView, parseLectureRequest } from "@/lib/lectures/view";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ lectureId: string }> };

/**
 * A lecture in one language: subtitles, study pack (no answer keys) and
 * preparation status. Public. Once everything is built the response is the
 * same for every student, so it's cacheable at the edge.
 */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const parsed = parseLectureRequest((await context.params).lectureId, new URL(request.url).searchParams.get("lang"));
  if (parsed instanceof Response) return parsed;

  const view = await getLectureView(parsed.lectureId, parsed.lang);
  if (!view) return Response.json({ error: "No such lecture." }, { status: 404 });
  return Response.json(view, {
    headers: {
      "cache-control": view.status.ready ? "public, s-maxage=3600, stale-while-revalidate=86400" : "no-store",
    },
  });
}
