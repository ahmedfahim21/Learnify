import { today } from "@/lib/flashcards/review";
import { quizSummary } from "@/lib/progress";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/** The profile's progress: flashcards due across every lecture, the streak, and finished quizzes. */
export async function GET(): Promise<Response> {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const [view, quizzes] = await Promise.all([today(userId), quizSummary(userId)]);
  return Response.json(
    {
      due: view.due,
      upcoming: view.upcoming,
      nextDueAt: view.nextDueAt?.toISOString() ?? null,
      streak: { current: view.streak.current, longest: view.streak.longest },
      quizzes,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
