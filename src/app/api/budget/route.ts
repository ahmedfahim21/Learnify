import { getBudget } from "@/lib/budget";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/** The caller's generative-UI budget for today. */
export async function GET(): Promise<Response> {
  const { userId, response } = await requireUserId();
  if (response) return response;
  return Response.json(await getBudget(userId));
}
