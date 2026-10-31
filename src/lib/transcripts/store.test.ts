import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import type { Lecture, NewTranscript, Transcript } from "@/db/schema";

import type { Segment } from "./merge";

import { ensureTranscript, LectureNotFoundError, type TranscriptDeps } from "./store";

const lecture: Lecture = {
  id: "lec-1",
  courseId: 106106127,
  position: 0,
  nptelLessonId: 1,
  unitName: "U",
  title: "Introduction to Computers and Programming",
  youtubeId: "DYFhgnaZCRE",
  conceptsCovered: null,
  vttRefs: { English: "en-ref" },
  createdAt: new Date(0),
};

const englishCues = "WEBVTT\n\n00:01.000 --> 00:04.000\nWelcome to the course.\n\n00:04.000 --> 00:09.000\nLet us begin.\n";

/** An in-memory transcripts table with the same insert-or-keep semantics as the real one. */
function fakeDeps(): TranscriptDeps & { rows: Transcript[] } {
  const rows: Transcript[] = [];
  return {
    rows,
    getLecture: vi.fn(async (id) => (id === lecture.id ? lecture : null)),
    getStored: vi.fn(async (id, lang) => rows.find((r) => r.lectureId === id && r.lang === lang) ?? null),
    save: vi.fn(async (row: NewTranscript) => {
      const existing = rows.find((r) => r.lectureId === row.lectureId && r.lang === row.lang);
      if (existing) return existing;
      const stored: Transcript = { id: `t${rows.length}`, createdAt: new Date(0), model: null, ...row };
      rows.push(stored);
      return stored;
    }),
    sources: {
      nptelVtt: vi.fn(async () => englishCues),
      youtubeCues: vi.fn(async () => []),
      translate: vi.fn(async (english: Segment[]) => ({
        segments: english.map((s) => ({ ...s, text: `ta:${s.text}` })),
        model: "mayura:v1",
      })),
    },
  };
}

let warn: MockInstance<typeof console.warn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe("ensureTranscript", () => {
  it("builds and stores English, with every field", async () => {
    const deps = fakeDeps();
    const t = await ensureTranscript("lec-1", "en", deps);
    expect(t).toEqual({
      id: "t0",
      createdAt: new Date(0),
      lectureId: "lec-1",
      lang: "en",
      source: "nptel",
      segments: [
        { i: 0, startSec: 1, endSec: 4, text: "Welcome to the course." },
        { i: 1, startSec: 4, endSec: 9, text: "Let us begin." },
      ],
      durationSec: 9,
      model: null,
    });
    expect(deps.rows).toHaveLength(1);
  });

  it("builds English first, then translates from it, storing both", async () => {
    const deps = fakeDeps();
    const ta = await ensureTranscript("lec-1", "ta", deps);
    expect(deps.rows.map((r) => r.lang)).toEqual(["en", "ta"]);
    expect(ta).toMatchObject({ lang: "ta", source: "sarvam", model: "mayura:v1", durationSec: 9 });
    expect(ta.segments).toEqual([
      { i: 0, startSec: 1, endSec: 4, text: "ta:Welcome to the course." },
      { i: 1, startSec: 4, endSec: 9, text: "ta:Let us begin." },
    ]);
  });

  it("serves a stored track without touching any source", async () => {
    const deps = fakeDeps();
    const first = await ensureTranscript("lec-1", "ta", deps);
    vi.mocked(deps.sources.nptelVtt).mockClear();
    vi.mocked(deps.sources.translate).mockClear();

    const second = await ensureTranscript("lec-1", "ta", deps);

    expect(second).toBe(first);
    expect(deps.sources.nptelVtt).not.toHaveBeenCalled();
    expect(deps.sources.translate).not.toHaveBeenCalled();
    expect(deps.rows).toHaveLength(2);
  });

  it("reuses stored English for a second language instead of refetching it", async () => {
    const deps = fakeDeps();
    await ensureTranscript("lec-1", "en", deps);
    vi.mocked(deps.sources.nptelVtt).mockClear();
    await ensureTranscript("lec-1", "hi", deps);
    expect(deps.sources.nptelVtt).not.toHaveBeenCalled();
    expect(deps.rows.map((r) => r.lang)).toEqual(["en", "hi"]);
  });

  it("logs which fallback a track came from", async () => {
    const deps = fakeDeps();
    vi.mocked(deps.sources.nptelVtt).mockRejectedValue(new Error("download failed (HTTP 404)"));
    vi.mocked(deps.sources.youtubeCues).mockResolvedValue([{ startSec: 0, endSec: 3, text: "Hello." }]);
    const t = await ensureTranscript("lec-1", "en", deps);
    expect(t.source).toBe("youtube");
    expect(warn).toHaveBeenCalledWith("transcript lec-1/en from youtube; NPTEL caption file: download failed (HTTP 404)");
  });

  it("throws for an unknown lecture and stores nothing", async () => {
    const deps = fakeDeps();
    await expect(ensureTranscript("nope", "en", deps)).rejects.toBeInstanceOf(LectureNotFoundError);
    expect(deps.rows).toHaveLength(0);
  });

  it("stores nothing when no source works", async () => {
    const deps = fakeDeps();
    vi.mocked(deps.sources.nptelVtt).mockRejectedValue(new Error("404"));
    vi.mocked(deps.sources.youtubeCues).mockRejectedValue(new Error("blocked"));
    await expect(ensureTranscript("lec-1", "en", deps)).rejects.toThrow(/No English transcript/);
    expect(deps.rows).toHaveLength(0);
  });
});
