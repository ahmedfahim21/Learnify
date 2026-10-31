import { getBudget } from "@/lib/budget";
import { isLang, LANGUAGES } from "@/lib/languages";
import { SarvamError, transcribe } from "@/lib/sarvam/client";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/** A 25-second doubt recorded as Opus is ~100 KB; 1 MB leaves room without inviting uploads. */
const MAX_AUDIO_BYTES = 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

/**
 * Transcribe a spoken doubt with Saaras in code-mix mode: Tamil words in
 * Tamil script, English terms in Latin, the way students actually speak. The
 * text goes back to the student to check and edit before it's asked.
 *
 * Signed in, and only while the student still has doubts left today — the
 * transcription is the first half of a doubt, so it shouldn't outlive the cap.
 */
export async function POST(request: Request): Promise<Response> {
  const { userId, response } = await requireUserId();
  if (response) return response;

  const declared = Number(request.headers.get("content-length"));
  if (declared > MAX_AUDIO_BYTES + 4096) return Response.json({ error: "Recording is too long." }, { status: 413 });

  const lang = new URL(request.url).searchParams.get("lang") ?? "";
  if (!isLang(lang)) return Response.json({ error: `Unsupported language "${lang}".` }, { status: 400 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected a multipart upload with an audio file." }, { status: 400 });
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob)) return Response.json({ error: "No audio in the upload." }, { status: 400 });
  if (audio.size > MAX_AUDIO_BYTES) return Response.json({ error: "Recording is too long." }, { status: 413 });
  const type = audio.type.split(";")[0].trim();
  const ext = EXTENSIONS[type];
  if (!ext) return Response.json({ error: `Unsupported audio type "${audio.type}".` }, { status: 415 });

  const budget = await getBudget(userId);
  if (budget.exceeded) {
    return Response.json({ error: `You've used all ${budget.limit} doubts for today.`, budget }, { status: 429 });
  }

  // Browsers label recordings "audio/webm;codecs=opus"; Sarvam accepts the
  // bare type and rejects the codec suffix, so send it under the bare type.
  const clean = new Blob([audio], { type });
  let transcript: string;
  try {
    ({ transcript } = await transcribe(clean, LANGUAGES[lang].sarvam, { filename: `doubt.${ext}`, tag: `stt ${userId}` }));
  } catch (err) {
    if (!(err instanceof SarvamError)) throw err;
    console.error(`transcribe for ${userId} failed:`, err.message);
    const busy = err.status === 429;
    return Response.json(
      { error: busy ? "Speech recognition is busy right now. Try again in a moment, or type your doubt." : "Couldn't transcribe that recording. Try again, or type your doubt." },
      { status: busy ? 503 : 502 },
    );
  }
  const text = transcript.trim();
  if (!text) return Response.json({ error: "Didn't catch that. Try again a little closer to the mic." }, { status: 422 });
  return Response.json({ text });
}
