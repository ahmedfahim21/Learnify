import { describe, expect, it } from "vitest";

import type { LectureStatus } from "@/lib/jobs/prepare";

import { describeStatus } from "./describeStatus";

const status = (stages: LectureStatus["stages"]): LectureStatus => ({ lang: "ta", ready: false, stages });

describe("describeStatus", () => {
  it("is null once everything is ready", () => {
    expect(describeStatus({ lang: "ta", ready: true, stages: [{ lang: "en", stage: "transcript", state: "ready" }] })).toBeNull();
  });

  it("talks about the first unfinished stage, with progress when it has a total", () => {
    expect(
      describeStatus(
        status([
          { lang: "en", stage: "transcript", state: "ready" },
          { lang: "ta", stage: "transcript", state: "running", progress: { done: 40, total: 76 } },
          { lang: "en", stage: "pack", state: "pending" },
        ]),
      ),
    ).toEqual({ text: "Preparing Tamil subtitles · 40 of 76", tone: "working" });
  });

  it.each([
    [{ lang: "en", stage: "transcript", state: "pending" }, "Fetching the lecture's captions"],
    [{ lang: "en", stage: "pack", state: "running", progress: null }, "Building checks, flashcards and the concept map"],
    [{ lang: "ta", stage: "pack", state: "pending" }, "Translating the study material into Tamil"],
  ] as const)("names stage %j", (stage, text) => {
    expect(describeStatus(status([stage as never]))).toEqual({ text, tone: "working" });
  });

  it("says a failed stage will be retried, or why it failed for good", () => {
    expect(describeStatus(status([{ lang: "en", stage: "pack", state: "failed", error: "x", willRetry: true }]))).toEqual({
      text: "Building checks, flashcards and the concept map hit a problem; trying again",
      tone: "retrying",
    });
    expect(
      describeStatus(status([{ lang: "en", stage: "transcript", state: "failed", error: "No English transcript", willRetry: false }])),
    ).toEqual({ text: "Fetching the lecture's captions failed: No English transcript", tone: "failed" });
  });
});
