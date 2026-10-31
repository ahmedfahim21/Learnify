import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { type Job, studyPacks, transcripts } from "@/db/schema";
import type { Lang } from "@/lib/languages";
import { STUDY_PROMPT_VERSION } from "@/lib/study/generate";
import { ensurePack } from "@/lib/study/store";
import { dbDeps as transcriptDeps, ensureTranscript } from "@/lib/transcripts/store";

import { type Claim, type ClaimResult, claimStage, fail, finish, heartbeat, isRateLimited, jobsFor, LostClaimError, MAX_ATTEMPTS, type Stage } from "./claim";

/**
 * Prepare a lecture in a language: English subtitles, then that language's,
 * then the English study pack, then its translation. Each stage is claimed
 * (lib/jobs/claim.ts) so concurrent requests never build the same thing twice.
 *
 * `runStages` is called from `after()` in POST /api/lectures/[id]/prepare. It
 * starts no new stage once STAGE_BUDGET_MS has passed, so every stage has
 * room inside the function's time limit; the client keeps polling prepare,
 * and the next poll picks up where this one stopped. A stage another request
 * is running is left to it.
 */

export const STAGE_BUDGET_MS = 120_000;
const HEARTBEAT_EVERY_MS = 20_000;

export interface StageKey {
  lang: Lang;
  stage: Stage;
}

export function stagesFor(lang: Lang): StageKey[] {
  if (lang === "en") return [{ lang: "en", stage: "transcript" }, { lang: "en", stage: "pack" }];
  return [
    { lang: "en", stage: "transcript" },
    { lang, stage: "transcript" },
    { lang: "en", stage: "pack" },
    { lang, stage: "pack" },
  ];
}

export interface PrepareDeps {
  hasOutput: (lectureId: string, key: StageKey) => Promise<boolean>;
  claim: (lectureId: string, key: StageKey) => Promise<ClaimResult>;
  heartbeat: typeof heartbeat;
  finish: typeof finish;
  fail: typeof fail;
  build: (lectureId: string, key: StageKey, claim: Claim, beat: typeof heartbeat) => Promise<void>;
  now: () => number;
}

export async function hasOutput(lectureId: string, { lang, stage }: StageKey): Promise<boolean> {
  const db = getDb();
  if (stage === "transcript") {
    const [row] = await db
      .select({ id: transcripts.id })
      .from(transcripts)
      .where(and(eq(transcripts.lectureId, lectureId), eq(transcripts.lang, lang)));
    return Boolean(row);
  }
  const [row] = await db
    .select({ id: studyPacks.id })
    .from(studyPacks)
    .where(
      and(
        eq(studyPacks.lectureId, lectureId),
        eq(studyPacks.lang, lang),
        eq(studyPacks.promptVersion, STUDY_PROMPT_VERSION),
      ),
    );
  return Boolean(row);
}

/** Build one stage, keeping the claim alive and saving translation progress as it goes. */
export async function buildStage(lectureId: string, { lang, stage }: StageKey, claim: Claim, beat: typeof heartbeat) {
  if (stage === "transcript") {
    const partial: Record<string, string> = { ...(claim.job.partial ?? {}) };
    const already = new Map(Object.entries(partial).map(([i, t]) => [Number(i), t]));
    // English exists by now for any other language (stagesFor orders it first).
    const total = lang === "en" ? 0 : ((await transcriptDeps.getStored(lectureId, "en"))?.segments.length ?? 0);
    let lastBeat = 0;
    await ensureTranscript(lectureId, lang, undefined, {
      already,
      onTranslated: async (items) => {
        for (const { i, text } of items) partial[i] = text;
        if (Date.now() - lastBeat < 3_000) return;
        lastBeat = Date.now();
        await beat(claim, { partial, progress: { done: Object.keys(partial).length, total } });
      },
    });
    return;
  }

  // One long model call: keep the claim alive on a timer while it runs.
  let lost: unknown = null;
  const timer = setInterval(() => {
    beat(claim).catch((err) => {
      lost = err;
    });
  }, HEARTBEAT_EVERY_MS);
  try {
    await ensurePack(lectureId, lang);
  } finally {
    clearInterval(timer);
  }
  if (lost) throw lost;
}

export const livePrepareDeps: PrepareDeps = {
  hasOutput,
  claim: (lectureId, { lang, stage }) => claimStage(lectureId, lang, stage),
  heartbeat,
  finish,
  fail,
  build: buildStage,
  now: () => Date.now(),
};

export interface RunReport {
  built: StageKey[];
  stoppedAt: (StageKey & { reason: "budget" | "busy" | "failed" | "error"; detail?: string }) | null;
}

export async function runStages(lectureId: string, lang: Lang, deps: PrepareDeps = livePrepareDeps): Promise<RunReport> {
  const started = deps.now();
  const built: StageKey[] = [];

  for (const key of stagesFor(lang)) {
    if (await deps.hasOutput(lectureId, key)) continue;
    if (deps.now() - started > STAGE_BUDGET_MS) return { built, stoppedAt: { ...key, reason: "budget" } };

    const result = await deps.claim(lectureId, key);
    if (!result.claimed) {
      const reason = result.job.status === "failed" ? "failed" : "busy";
      return { built, stoppedAt: { ...key, reason, detail: result.job.error ?? undefined } };
    }

    const tag = `${lectureId}/${key.lang}/${key.stage}`;
    try {
      await deps.build(lectureId, key, result.claim, deps.heartbeat);
      await deps.finish(result.claim);
      built.push(key);
      console.info(`job done ${tag} (attempt ${result.claim.job.attempts})`);
    } catch (err) {
      if (err instanceof LostClaimError) {
        console.warn(`job ${tag}: ${err.message}; leaving it to the new owner`);
        return { built, stoppedAt: { ...key, reason: "busy" } };
      }
      const message = err instanceof Error ? err.message : String(err);
      const transient = isRateLimited(message);
      console.error(
        `job failed ${tag} (attempt ${result.claim.job.attempts}/${MAX_ATTEMPTS}${transient ? ", rate-limited: not counted" : ""}): ${message}`,
      );
      await deps.fail(result.claim, message, { transient });
      return { built, stoppedAt: { ...key, reason: "error", detail: message } };
    }
  }
  return { built, stoppedAt: null };
}

// --- Status for the API ----------------------------------------------------

export type StageState =
  | { state: "ready" }
  | { state: "pending" }
  | { state: "running"; progress: Job["progress"] }
  | { state: "failed"; error: string | null; willRetry: boolean };

export interface LectureStatus {
  lang: Lang;
  stages: (StageKey & StageState)[];
  ready: boolean;
}

export async function lectureStatus(
  lectureId: string,
  lang: Lang,
  deps: Pick<PrepareDeps, "hasOutput"> & { jobs: (lectureId: string, lang: Lang) => Promise<Job[]> } = {
    hasOutput,
    jobs: jobsFor,
  },
): Promise<LectureStatus> {
  const rows = await deps.jobs(lectureId, lang);
  const stages = await Promise.all(
    stagesFor(lang).map(async (key): Promise<StageKey & StageState> => {
      if (await deps.hasOutput(lectureId, key)) return { ...key, state: "ready" };
      const job = rows.find((j) => j.lang === key.lang && j.stage === key.stage);
      if (!job) return { ...key, state: "pending" };
      if (job.status === "failed") {
        return { ...key, state: "failed", error: job.error, willRetry: job.attempts < MAX_ATTEMPTS };
      }
      return { ...key, state: "running", progress: job.progress };
    }),
  );
  return { lang, stages, ready: stages.every((s) => s.state === "ready") };
}
