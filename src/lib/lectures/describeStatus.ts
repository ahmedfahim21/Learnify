import type { LectureStatus } from "@/lib/jobs/prepare";
import { LANGUAGES } from "@/lib/languages";

/**
 * Preparation status in words a student understands, for the line under the
 * player. The first stage that isn't ready is the one worth talking about;
 * stages after it are just waiting their turn.
 */

export interface StatusLine {
  text: string;
  tone: "working" | "retrying" | "failed";
}

export function describeStatus(status: LectureStatus): StatusLine | null {
  const stage = status.stages.find((s) => s.state !== "ready");
  if (!stage) return null;
  const name = LANGUAGES[stage.lang].name;

  const what =
    stage.stage === "transcript"
      ? stage.lang === "en"
        ? "Fetching the lecture's captions"
        : `Preparing ${name} subtitles`
      : stage.lang === "en"
        ? "Building checks, flashcards and the concept map"
        : `Translating the study material into ${name}`;

  if (stage.state === "failed") {
    if (stage.willRetry && stage.error && /HTTP 429|rate limit/i.test(stage.error)) {
      return { text: `${what}: Sarvam is busy, picking up where it left off shortly`, tone: "retrying" };
    }
    return stage.willRetry
      ? { text: `${what} hit a problem; trying again`, tone: "retrying" }
      : { text: `${what} failed: ${stage.error ?? "unknown error"}`, tone: "failed" };
  }
  if (stage.state === "running" && stage.progress && stage.progress.total > 0) {
    return { text: `${what} · ${stage.progress.done} of ${stage.progress.total}`, tone: "working" };
  }
  return { text: what, tone: "working" };
}
