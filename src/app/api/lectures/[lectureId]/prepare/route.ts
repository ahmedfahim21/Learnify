import { after } from "next/server";

import { stagesStartedToday } from "@/lib/jobs/claim";
import { lectureStatus, runStages } from "@/lib/jobs/prepare";
import { parseLectureRequest } from "@/lib/lectures/view";
import { getCurrentUserId } from "@/lib/session";
import { dbDeps as transcriptDeps } from "@/lib/transcripts/store";

export const runtime = "nodejs";
// Stages run in after(); runStages starts none past 120 s, leaving room here.
export const maxDuration = 300;

const DEFAULT_PREP_DAILY_LIMIT = 300;

function prepDailyLimit(): number {
  const raw = Number(process.env.LECTURE_PREP_DAILY_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_PREP_DAILY_LIMIT;
}

type RouteContext = { params: Promise<{ lectureId: string }> };

/**
 * Start (or keep going with) preparing a lecture in a language. Idempotent:
 * the player polls this until `status.ready`, and each call claims whatever
 * stage is free and builds it in the background.
 *
 * Anyone may poll a lecture that's ready or already being built. Starting new
 * work costs Sarvam calls, so it needs a signed-in user and is capped across
 * everyone per UTC day.
 */
export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const parsed = parseLectureRequest((await context.params).lectureId, new URL(request.url).searchParams.get("lang"));
  if (parsed instanceof Response) return parsed;
  const { lectureId, lang } = parsed;

  const lecture = await transcriptDeps.getLecture(lectureId);
  if (!lecture) return Response.json({ error: "No such lecture." }, { status: 404 });
  if (!lecture.youtubeId) return Response.json({ error: "This lecture has no video." }, { status: 422 });

  const status = await lectureStatus(lectureId, lang);
  if (status.ready) return Response.json({ status });

  const needsNewWork = status.stages.some((s) => s.state === "pending" || (s.state === "failed" && s.willRetry));
  if (needsNewWork) {
    if (!(await getCurrentUserId())) {
      return Response.json({ error: "Sign in to prepare this lecture.", status }, { status: 401 });
    }
    if (status.stages.some((s) => s.state === "pending") && (await stagesStartedToday()) >= prepDailyLimit()) {
      return Response.json(
        { error: "Today's limit for preparing new lectures is reached. Try again after midnight UTC.", status },
        { status: 429 },
      );
    }
  }

  after(async () => {
    try {
      const report = await runStages(lectureId, lang);
      if (report.stoppedAt && report.stoppedAt.reason !== "busy") {
        console.info(`prepare ${lectureId}/${lang} stopped at ${report.stoppedAt.lang}/${report.stoppedAt.stage}: ${report.stoppedAt.reason}`);
      }
    } catch (err) {
      // Claim/DB failures outside a stage: nothing else will report them.
      console.error(`prepare ${lectureId}/${lang} crashed:`, err);
    }
  });
  return Response.json({ status }, { status: 202 });
}
