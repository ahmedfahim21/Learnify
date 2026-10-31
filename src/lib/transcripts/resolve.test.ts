import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { Segment } from "./merge";
import { resolveEnglish, resolveLanguage, type TranscriptSources, TranscriptUnavailableError } from "./resolve";

const EN_VTT = readFileSync(join(__dirname, "__fixtures__", "nptel-en.vtt"), "utf8");
const TA_VTT = readFileSync(join(__dirname, "__fixtures__", "nptel-ta.vtt"), "utf8");

function sources(over: Partial<TranscriptSources> = {}): TranscriptSources {
  return {
    nptelVtt: vi.fn(async (ref: string) => {
      if (ref === "en-ref") return EN_VTT;
      if (ref === "ta-ref") return TA_VTT;
      throw new Error("NPTEL VTT x: download failed (HTTP 404)");
    }),
    youtubeCues: vi.fn(async () => [
      { startSec: 1, endSec: 4, text: "Hello, so this is course on Basic Calculus." },
      { startSec: 4, endSec: 9, text: "It is the first part." },
    ]),
    translate: vi.fn(async (english: Segment[]) => ({
      segments: english.map((s) => ({ ...s, text: `ta:${s.text}` })),
      model: "mayura:v1",
    })),
    ...over,
  };
}

describe("resolveEnglish", () => {
  it("prefers NPTEL's caption file", async () => {
    const src = sources();
    const r = await resolveEnglish({ youtubeId: "DYFhgnaZCRE", vttRefs: { English: "en-ref" } }, src);
    expect(r.source).toBe("nptel");
    expect(r.model).toBeNull();
    expect(r.attempts).toEqual([]);
    expect(r.segments[0].text).toMatch(/^Welcome to this online course on programming/);
    expect(r.durationSec).toBe(r.segments.at(-1)!.endSec);
    expect(src.youtubeCues).not.toHaveBeenCalled();
  });

  it("falls back to YouTube when NPTEL's file is dead, and says why", async () => {
    const r = await resolveEnglish({ youtubeId: "suv-iQnlETc", vttRefs: { English: "dead-ref" } }, sources());
    expect(r).toEqual({
      source: "youtube",
      segments: [
        { i: 0, startSec: 1, endSec: 4, text: "Hello, so this is course on Basic Calculus." },
        { i: 1, startSec: 4, endSec: 9, text: "It is the first part." },
      ],
      durationSec: 9,
      model: null,
      attempts: ["NPTEL caption file: NPTEL VTT x: download failed (HTTP 404)"],
    });
  });

  it("falls back to YouTube when NPTEL lists no English file", async () => {
    const r = await resolveEnglish({ youtubeId: "suv-iQnlETc", vttRefs: {} }, sources());
    expect(r.source).toBe("youtube");
    expect(r.attempts).toEqual(["NPTEL lists no English caption file"]);
  });

  it("throws with every attempt when both sources fail", async () => {
    const src = sources({ youtubeCues: vi.fn(async () => Promise.reject(new Error("blocked"))) });
    const err = await resolveEnglish({ youtubeId: "suv-iQnlETc", vttRefs: { English: "dead-ref" } }, src).catch((e) => e);
    expect(err).toBeInstanceOf(TranscriptUnavailableError);
    expect(err.attempts).toEqual([
      "NPTEL caption file: NPTEL VTT x: download failed (HTTP 404)",
      "YouTube captions: blocked",
    ]);
  });

  it("says so when there is no video to fall back to", async () => {
    const err = await resolveEnglish({ youtubeId: null, vttRefs: {} }, sources()).catch((e) => e);
    expect(err.attempts).toEqual(["NPTEL lists no English caption file", "lecture has no YouTube video"]);
  });
});

describe("resolveLanguage", () => {
  const lecture = { youtubeId: "DYFhgnaZCRE", vttRefs: { English: "en-ref", Tamil: "ta-ref", Hindi: "dead-ref" } };

  it("returns the English unchanged for en", async () => {
    const src = sources();
    const en = await resolveEnglish(lecture, src);
    expect(await resolveLanguage(lecture, "en", en, src)).toBe(en);
  });

  it("uses NPTEL's human translation when its timing matches", async () => {
    const src = sources();
    const en = await resolveEnglish(lecture, src);
    // The Tamil fixture is the first ~57 s of the lecture; give English the same length.
    const ta = await resolveLanguage(lecture, "ta", { ...en, durationSec: 57 }, src);
    expect(ta.source).toBe("nptel");
    expect(ta.model).toBeNull();
    expect(ta.segments[0].text).toMatch(/^ப்ரொக்ராமிங் குறித்த/);
    expect(src.translate).not.toHaveBeenCalled();
  });

  it("machine-translates when the human track is for a different cut", async () => {
    const src = sources();
    const en = await resolveEnglish(lecture, src);
    const ta = await resolveLanguage(lecture, "ta", { ...en, durationSec: 3000 }, src);
    expect(ta.source).toBe("sarvam");
    expect(ta.model).toBe("mayura:v1");
    expect(ta.attempts[0]).toMatch(/^NPTEL Tamil caption file: runs \d+s against the English 3000s; likely a different cut$/);
  });

  it("machine-translates when the human file is dead, keeping English timestamps", async () => {
    const src = sources();
    const en = await resolveEnglish(lecture, src);
    const hi = await resolveLanguage(lecture, "hi", en, src);
    expect(hi.source).toBe("sarvam");
    expect(hi.durationSec).toBe(en.durationSec);
    expect(hi.segments.map(({ i, startSec, endSec }) => ({ i, startSec, endSec }))).toEqual(
      en.segments.map(({ i, startSec, endSec }) => ({ i, startSec, endSec })),
    );
    expect(hi.attempts).toEqual(["NPTEL Hindi caption file: NPTEL VTT x: download failed (HTTP 404)"]);
  });

  it("machine-translates when NPTEL has no track at all", async () => {
    const src = sources();
    const en = await resolveEnglish(lecture, src);
    const kn = await resolveLanguage(lecture, "kn", en, src);
    expect(kn.source).toBe("sarvam");
    expect(kn.attempts).toEqual([]);
  });

  it("throws with every attempt when translation fails too", async () => {
    const src = sources({ translate: vi.fn(async () => Promise.reject(new Error("Sarvam /translate failed (HTTP 503)"))) });
    const en = await resolveEnglish(lecture, src);
    const err = await resolveLanguage(lecture, "hi", en, src).catch((e) => e);
    expect(err).toBeInstanceOf(TranscriptUnavailableError);
    expect(err.message).toBe(
      "No Hindi transcript: NPTEL Hindi caption file: NPTEL VTT x: download failed (HTTP 404); machine translation: Sarvam /translate failed (HTTP 503)",
    );
  });
});
