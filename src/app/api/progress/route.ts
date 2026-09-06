import { DESIGN_PHASES } from "@/content/systemDesign/types";
import { getProblem } from "@/content/systemDesign";
import { getCourseProgress, markChapterComplete } from "@/lib/progress";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/** Every course's completion state for the signed-in learner. */
export async function GET(): Promise<Response> {
  const { userId, response } = await requireUserId();
  if (response) return response;
  return Response.json({ progress: await getCourseProgress(userId) });
}

/** Mark one chapter of one course as read. Idempotent. */
export async function POST(request: Request): Promise<Response> {
  const { userId, response } = await requireUserId();
  if (response) return response;

  let body: { problemSlug?: unknown; phase?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const problemSlug = typeof body.problemSlug === "string" ? body.problemSlug : "";
  const phase = typeof body.phase === "string" ? body.phase : "";

  // Validate against the authored content rather than trusting the client,
  // so the table can't accumulate rows for courses or phases that don't exist.
  if (!getProblem(problemSlug)) {
    return Response.json({ error: "unknown course" }, { status: 400 });
  }
  if (!(DESIGN_PHASES as readonly string[]).includes(phase)) {
    return Response.json({ error: "unknown chapter phase" }, { status: 400 });
  }

  await markChapterComplete(userId, problemSlug, phase);
  return Response.json({ ok: true }, { status: 201 });
}
