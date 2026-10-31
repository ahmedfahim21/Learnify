import { z } from "zod";

import { getOwnDoubt } from "@/lib/doubts/answer";
import { speakableText } from "@/lib/doubts/speech";
import { isLang, LANGUAGES } from "@/lib/languages";
import { speak } from "@/lib/sarvam/client";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

const body = z.object({ doubtId: z.uuid() });

/**
 * Read a doubt's answer aloud with Bulbul. Takes the doubt's id, never raw
 * text, so it only ever speaks answers this student was given.
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
  if (!parsed.success) return Response.json({ error: "doubtId must be a uuid." }, { status: 400 });

  const doubt = await getOwnDoubt(userId, parsed.data.doubtId);
  if (!doubt || doubt.status !== "answered" || !doubt.answer) {
    return Response.json({ error: "No such answer." }, { status: 404 });
  }
  const lang = isLang(doubt.lang) ? doubt.lang : "en";
  const text = speakableText(doubt.answer);
  if (!text) return Response.json({ error: "This answer has nothing to read aloud." }, { status: 422 });

  const wav = await speak(text, LANGUAGES[lang].sarvam, { tag: `tts ${doubt.id}` });
  return new Response(wav as unknown as BodyInit, {
    headers: { "content-type": "audio/wav", "cache-control": "private, max-age=3600" },
  });
}
