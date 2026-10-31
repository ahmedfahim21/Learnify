import { z } from "zod";

import { RATINGS, reviewCard, UnknownCardError } from "@/lib/flashcards/review";
import { isLang, type Lang } from "@/lib/languages";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

const body = z.object({
  lectureId: z.uuid(),
  lang: z.custom<Lang>((v) => typeof v === "string" && isLang(v), "unsupported language"),
  cardId: z.string().regex(/^[0-9a-f]{16}$/),
  rating: z.enum(Object.keys(RATINGS) as [keyof typeof RATINGS, ...(keyof typeof RATINGS)[]]),
});

/**
 * Record how well a student knew a flashcard and schedule its next review
 * (SM-2). The card is looked up in the lecture's own pack, so only real cards
 * can be scheduled, and its text is snapshotted for Today.
 */
export async function POST(request: Request): Promise<Response> {
  const { userId, response } = await requireUserId();
  if (response) return response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const parsed = body.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Invalid review", issues: parsed.error.issues }, { status: 400 });

  try {
    const result = await reviewCard(userId, parsed.data);
    return Response.json({
      cardId: result.cardId,
      dueAt: result.dueAt.toISOString(),
      intervalDays: result.intervalDays,
      streak: result.streak,
    });
  } catch (err) {
    if (err instanceof UnknownCardError) return Response.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
