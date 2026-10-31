import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Job } from "@/db/schema";

import { LostClaimError } from "./claim";
import { lectureStatus, type PrepareDeps, runStages, STAGE_BUDGET_MS, stagesFor } from "./prepare";

const job = (over: Partial<Job> = {}): Job => ({
  id: "j1",
  lectureId: "lec-1",
  lang: "en",
  stage: "transcript",
  status: "running",
  claimToken: "tok",
  attempts: 1,
  progress: null,
  partial: null,
  error: null,
  heartbeatAt: new Date(0),
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...over,
});

function deps(over: Partial<PrepareDeps> = {}): PrepareDeps {
  return {
    hasOutput: vi.fn(async () => false),
    claim: vi.fn(async (_id, key) => ({ claimed: true as const, claim: { job: job({ lang: key.lang, stage: key.stage }), token: "tok" } })),
    heartbeat: vi.fn(async () => {}),
    finish: vi.fn(async () => {}),
    fail: vi.fn(async () => {}),
    build: vi.fn(async () => {}),
    now: () => 0,
    ...over,
  };
}

let spies: ReturnType<typeof vi.spyOn>[];
beforeEach(() => {
  spies = (["info", "warn", "error"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
});
afterEach(() => spies.forEach((s) => s.mockRestore()));

describe("stagesFor", () => {
  it("builds English first, then the language, subtitles before packs", () => {
    expect(stagesFor("ta")).toEqual([
      { lang: "en", stage: "transcript" },
      { lang: "ta", stage: "transcript" },
      { lang: "en", stage: "pack" },
      { lang: "ta", stage: "pack" },
    ]);
    expect(stagesFor("en")).toEqual([
      { lang: "en", stage: "transcript" },
      { lang: "en", stage: "pack" },
    ]);
  });
});

describe("runStages", () => {
  it("builds and finishes every missing stage in order", async () => {
    const d = deps();
    const report = await runStages("lec-1", "ta", d);
    expect(report).toEqual({ built: stagesFor("ta"), stoppedAt: null });
    expect(vi.mocked(d.build).mock.calls.map((c) => c[1])).toEqual(stagesFor("ta"));
    expect(d.finish).toHaveBeenCalledTimes(4);
    expect(d.fail).not.toHaveBeenCalled();
  });

  it("skips stages whose output already exists, without claiming them", async () => {
    const d = deps({ hasOutput: vi.fn(async (_id, key) => key.stage === "transcript") });
    const report = await runStages("lec-1", "ta", d);
    expect(report.built).toEqual([
      { lang: "en", stage: "pack" },
      { lang: "ta", stage: "pack" },
    ]);
    expect(vi.mocked(d.claim).mock.calls.map((c) => c[1].stage)).toEqual(["pack", "pack"]);
  });

  it("stops at a stage someone else is running", async () => {
    const d = deps({ claim: vi.fn(async () => ({ claimed: false as const, job: job({ status: "running" }) })) });
    expect(await runStages("lec-1", "ta", d)).toEqual({ built: [], stoppedAt: { lang: "en", stage: "transcript", reason: "busy" } });
    expect(d.build).not.toHaveBeenCalled();
  });

  it("stops at a stage that failed for good, passing on its error", async () => {
    const d = deps({ claim: vi.fn(async () => ({ claimed: false as const, job: job({ status: "failed", attempts: 3, error: "No English transcript" }) })) });
    expect((await runStages("lec-1", "en", d)).stoppedAt).toEqual({
      lang: "en",
      stage: "transcript",
      reason: "failed",
      detail: "No English transcript",
    });
  });

  it("records a build failure on the job and stops", async () => {
    const d = deps({ build: vi.fn(async () => Promise.reject(new Error("Sarvam /translate failed (HTTP 503)"))) });
    const report = await runStages("lec-1", "ta", d);
    expect(report).toEqual({
      built: [],
      stoppedAt: { lang: "en", stage: "transcript", reason: "error", detail: "Sarvam /translate failed (HTTP 503)" },
    });
    expect(d.fail).toHaveBeenCalledWith(expect.objectContaining({ token: "tok" }), "Sarvam /translate failed (HTTP 503)");
    expect(d.finish).not.toHaveBeenCalled();
  });

  it("backs off without marking failure when its claim was taken over", async () => {
    const d = deps({ build: vi.fn(async () => Promise.reject(new LostClaimError("j1"))) });
    expect((await runStages("lec-1", "en", d)).stoppedAt).toEqual({ lang: "en", stage: "transcript", reason: "busy" });
    expect(d.fail).not.toHaveBeenCalled();
  });

  it("starts no new stage once the time budget is spent", async () => {
    let t = 0;
    const d = deps({
      now: () => t,
      build: vi.fn(async () => {
        t += STAGE_BUDGET_MS + 1;
      }),
    });
    const report = await runStages("lec-1", "ta", d);
    expect(report).toEqual({ built: [{ lang: "en", stage: "transcript" }], stoppedAt: { lang: "ta", stage: "transcript", reason: "budget" } });
  });
});

describe("lectureStatus", () => {
  it("reports each stage as ready, running, failed or pending", async () => {
    const status = await lectureStatus("lec-1", "ta", {
      hasOutput: async (_id, key) => key.lang === "en" && key.stage === "transcript",
      jobs: async () => [
        job({ lang: "ta", stage: "transcript", status: "running", progress: { done: 40, total: 0 } }),
        job({ lang: "en", stage: "pack", status: "failed", attempts: 1, error: "truncated" }),
      ],
    });
    expect(status).toEqual({
      lang: "ta",
      ready: false,
      stages: [
        { lang: "en", stage: "transcript", state: "ready" },
        { lang: "ta", stage: "transcript", state: "running", progress: { done: 40, total: 0 } },
        { lang: "en", stage: "pack", state: "failed", error: "truncated", willRetry: true },
        { lang: "ta", stage: "pack", state: "pending" },
      ],
    });
  });

  it("is ready when every stage's output exists", async () => {
    const status = await lectureStatus("lec-1", "en", { hasOutput: async () => true, jobs: async () => [] });
    expect(status.ready).toBe(true);
  });
});
