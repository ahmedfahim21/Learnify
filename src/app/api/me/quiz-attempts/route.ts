import { attemptSchema, recordQuiz } from "@/lib/progress";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/** Store a finished quiz for the caller and count it toward their streak. */
export async function POST(request: Request): Promise<Response> {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const body: unknown = await request.json().catch(() => null);
  const parsed = attemptSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ") }, { status: 400 });
  }
  return Response.json(await recordQuiz(userId, parsed.data), { status: 201 });
}
