import { today } from "@/lib/flashcards/review";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/** The profile's progress: flashcards due now across every lecture, what's coming up, and the streak. */
export async function GET(): Promise<Response> {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const view = await today(userId);
  return Response.json(
    {
      due: view.due,
      upcoming: view.upcoming,
      nextDueAt: view.nextDueAt?.toISOString() ?? null,
      streak: { current: view.streak.current, longest: view.streak.longest },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
