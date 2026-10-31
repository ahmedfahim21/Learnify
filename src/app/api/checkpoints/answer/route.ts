import { z } from "zod";

import { isLang, type Lang } from "@/lib/languages";
import { grade } from "@/lib/study/grading";
import { dbPackDeps } from "@/lib/study/store";

export const runtime = "nodejs";

const body = z.object({
  lectureId: z.uuid(),
  lang: z.custom<Lang>((v) => typeof v === "string" && isLang(v), "unsupported language"),
  checkpointId: z.string().min(1).max(100),
  choice: z.number().int().min(0).max(3),
  attempt: z.number().int().min(1).max(10),
});

/**
 * Grade a check. The answer key lives only on the server; the reply says
 * whether the choice was right and where to replay, and releases the
 * explanation and the right option only when the flow has earned them.
 */
export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const parsed = body.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Invalid answer", issues: parsed.error.issues }, { status: 400 });
  const { lectureId, lang, checkpointId, choice, attempt } = parsed.data;

  const pack = await dbPackDeps.getStored(lectureId, lang);
  if (!pack) return Response.json({ error: "This lecture's checks aren't ready." }, { status: 404 });
  const result = grade(pack.payload, checkpointId, choice, attempt);
  if (!result) return Response.json({ error: "No such check in this lecture." }, { status: 404 });
  return Response.json(result);
}
