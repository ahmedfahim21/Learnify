import { z } from "zod";

import { bestScores } from "@/lib/progress";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

const query = z.array(z.uuid()).min(1).max(200);

/** The caller's best quiz score on each of these lectures (?lectureIds=a,b,c), for marking a course page. */
export async function GET(request: Request): Promise<Response> {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const ids = (new URL(request.url).searchParams.get("lectureIds") ?? "").split(",").filter(Boolean);
  const parsed = query.safeParse(ids);
  if (!parsed.success) return Response.json({ error: "lectureIds must be 1 to 200 comma-separated uuids." }, { status: 400 });
  return Response.json({ best: await bestScores(userId, parsed.data) }, { headers: { "cache-control": "no-store" } });
}
