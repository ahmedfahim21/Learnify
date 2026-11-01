import { z } from "zod";

import { consumeDoubt } from "@/lib/budget";
import { answerDoubt, listOwnDoubts, NotReadyError, prepareDoubt } from "@/lib/doubts/answer";
import { isLang, type Lang } from "@/lib/languages";
import { requireUserId } from "@/lib/session";
import { touchStreak } from "@/lib/streaks";

export const runtime = "nodejs";
export const maxDuration = 60;

const ask = z.object({
  lectureId: z.uuid(),
  lang: z.custom<Lang>((v) => typeof v === "string" && isLang(v), "unsupported language"),
  atSec: z.number().min(0).max(24 * 3600),
  question: z.string().trim().min(2).max(500),
});

/**
 * Ask a doubt about the moment the student paused at. Streams newline-
 * delimited JSON events (see lib/doubts/answer.ts). Costs one unit of the
 * daily doubt budget, refunded if we fail to answer.
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
  const parsed = ask.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Invalid doubt", issues: parsed.error.issues }, { status: 400 });
  const input = { userId, ...parsed.data };

  let messages;
  try {
    messages = await prepareDoubt(input);
  } catch (err) {
    if (err instanceof NotReadyError) return Response.json({ error: err.message }, { status: 409 });
    throw err;
  }

  const { allowed, state } = await consumeDoubt(userId);
  if (!allowed) {
    return Response.json({ error: `You've used all ${state.limit} doubts for today. They reset at midnight UTC.`, budget: state }, { status: 429 });
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for await (const event of answerDoubt(input, messages)) {
        // An answered doubt counts toward the streak, before the student hears it's done.
        if (event.type === "done") await touchStreak(userId);
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }
      controller.close();
    },
  });
  return new Response(body, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-doubts-remaining": String(state.remaining),
    },
  });
}

/** The caller's answered doubts on a lecture, newest first. */
export async function GET(request: Request): Promise<Response> {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const lectureId = new URL(request.url).searchParams.get("lectureId") ?? "";
  if (!z.uuid().safeParse(lectureId).success) return Response.json({ error: "lectureId must be a uuid." }, { status: 400 });
  const rows = await listOwnDoubts(userId, lectureId);
  return Response.json({
    doubts: rows.map((d) => ({ id: d.id, lang: d.lang, atSec: d.atSec, question: d.question, answer: d.answer, createdAt: d.createdAt })),
  });
}
