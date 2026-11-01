import { activitySchema, recordActivity } from "@/lib/progress";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/** Study that isn't stored on its own, like finishing a lecture's notes, still counts toward the streak. */
export async function POST(request: Request): Promise<Response> {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const body: unknown = await request.json().catch(() => null);
  const parsed = activitySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "kind must be \"notes\" and lectureId a uuid." }, { status: 400 });
  return Response.json(await recordActivity(userId));
}
