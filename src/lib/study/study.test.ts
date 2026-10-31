import { describe, expect, it, vi } from "vitest";

import type { NewStudyPackRow, StudyPackRow } from "@/db/schema";

import { STUDY_PROMPT_VERSION } from "./generate";
import { grade, publicPack } from "./grading";
import type { StudyPack } from "./pack";
import { ensurePack, MissingTranscriptError, type PackDeps } from "./store";
import { translatePack } from "./translatePack";

const english: StudyPack = {
  concepts: [{ id: "c1", title: "Stored program", summary: "Programs live in memory.", startSec: 10, endSec: 90, prereqIds: [] }],
  checkpoints: [
    {
      id: "k1",
      atSec: 120,
      conceptId: "c1",
      question: "Where does the program live?",
      options: ["Disk", "Memory", "ALU", "Bus"],
      answerIndex: 1,
      explanation: "The stored-program idea keeps it in memory.",
      replayFrom: 40,
      replayTo: 90,
    },
  ],
  flashcards: [{ front: "ENIAC", back: "First digital computer", startSec: 55 }],
  recap: { summary: "Computers run stored programs.", keyPoints: [{ text: "Memory holds code", startSec: 60 }] },
};

describe("translatePack", () => {
  it("translates every prose field and copies ids, times and the answer key", async () => {
    const sent: string[][] = [];
    const ta = await translatePack(english, "ta", async (texts) => {
      sent.push(texts);
      return texts.map((t) => `ta:${t}`);
    });

    expect(sent).toEqual([
      [
        "Stored program",
        "Programs live in memory.",
        "Where does the program live?",
        "Disk",
        "Memory",
        "ALU",
        "Bus",
        "The stored-program idea keeps it in memory.",
        "ENIAC",
        "First digital computer",
        "Computers run stored programs.",
        "Memory holds code",
      ],
    ]);
    expect(ta).toEqual({
      concepts: [{ id: "c1", title: "ta:Stored program", summary: "ta:Programs live in memory.", startSec: 10, endSec: 90, prereqIds: [] }],
      checkpoints: [
        {
          id: "k1",
          atSec: 120,
          conceptId: "c1",
          question: "ta:Where does the program live?",
          options: ["ta:Disk", "ta:Memory", "ta:ALU", "ta:Bus"],
          answerIndex: 1,
          explanation: "ta:The stored-program idea keeps it in memory.",
          replayFrom: 40,
          replayTo: 90,
        },
      ],
      flashcards: [{ front: "ta:ENIAC", back: "ta:First digital computer", startSec: 55 }],
      recap: { summary: "ta:Computers run stored programs.", keyPoints: [{ text: "ta:Memory holds code", startSec: 60 }] },
    });
    expect(english.concepts[0].title).toBe("Stored program");
  });

  it("refuses a translator that drops strings", async () => {
    await expect(translatePack(english, "ta", async (texts) => texts.slice(1))).rejects.toThrow(/returned 11 strings for 12/);
  });
});

describe("publicPack", () => {
  it("removes answer keys and explanations, and nothing else", () => {
    const pub = publicPack(english);
    expect(pub.checkpoints).toEqual([
      { id: "k1", atSec: 120, conceptId: "c1", question: "Where does the program live?", options: ["Disk", "Memory", "ALU", "Bus"], replayFrom: 40, replayTo: 90 },
    ]);
    expect(JSON.stringify(pub)).not.toMatch(/answerIndex|stored-program idea/);
    expect({ ...pub, checkpoints: undefined }).toEqual({ ...english, checkpoints: undefined });
  });
});

describe("grade", () => {
  it("a right answer gets the explanation but not the index", () => {
    expect(grade(english, "k1", 1, 1)).toEqual({
      correct: true,
      replayFrom: 40,
      replayTo: 90,
      explanation: "The stored-program idea keeps it in memory.",
      answerIndex: null,
    });
  });

  it("a first wrong answer gets only the replay range", () => {
    expect(grade(english, "k1", 0, 1)).toEqual({ correct: false, replayFrom: 40, replayTo: 90, explanation: null, answerIndex: null });
  });

  it("a second wrong answer reveals the answer and why", () => {
    expect(grade(english, "k1", 3, 2)).toEqual({
      correct: false,
      replayFrom: 40,
      replayTo: 90,
      explanation: "The stored-program idea keeps it in memory.",
      answerIndex: 1,
    });
  });

  it("returns null for an unknown check", () => {
    expect(grade(english, "nope", 0, 1)).toBeNull();
  });
});

function fakePackDeps(segments: PackDeps["getEnglishSegments"] = async () => [{ i: 0, startSec: 0, endSec: 200, text: "x" }]) {
  const rows: StudyPackRow[] = [];
  const deps: PackDeps = {
    getLecture: vi.fn(async (id) => (id === "lec-1" ? ({ id, title: "Intro" } as never) : null)),
    getEnglishSegments: vi.fn(segments),
    getStored: vi.fn(async (id, lang) => rows.find((r) => r.lectureId === id && r.lang === lang) ?? null),
    save: vi.fn(async (row: NewStudyPackRow) => {
      const existing = rows.find((r) => r.lectureId === row.lectureId && r.lang === row.lang);
      if (existing) return existing;
      const stored = { id: `p${rows.length}`, createdAt: new Date(0), ...row } as StudyPackRow;
      rows.push(stored);
      return stored;
    }),
    generate: vi.fn(async () => ({ pack: english, model: "sarvam-105b" })),
    translate: vi.fn(async (pack: StudyPack) => ({ ...pack, recap: { ...pack.recap, summary: "ta" } })),
  };
  return { deps, rows };
}

describe("ensurePack", () => {
  it("generates English, then translates it, storing both at the current prompt version", async () => {
    const { deps, rows } = fakePackDeps();
    const ta = await ensurePack("lec-1", "ta", deps);
    expect(rows.map((r) => [r.lang, r.model, r.promptVersion])).toEqual([
      ["en", "sarvam-105b", STUDY_PROMPT_VERSION],
      ["ta", "sarvam-105b+translated:sarvam-105b-conversations,mayura:v1", STUDY_PROMPT_VERSION],
    ]);
    expect(ta.payload.recap.summary).toBe("ta");
    expect(deps.generate).toHaveBeenCalledWith("Intro", [{ i: 0, startSec: 0, endSec: 200, text: "x" }]);
    expect(deps.translate).toHaveBeenCalledWith(english, "ta", "lecture lec-1/ta pack");
  });

  it("serves a stored pack without generating or translating", async () => {
    const { deps } = fakePackDeps();
    await ensurePack("lec-1", "ta", deps);
    vi.mocked(deps.generate).mockClear();
    vi.mocked(deps.translate).mockClear();
    await ensurePack("lec-1", "ta", deps);
    expect(deps.generate).not.toHaveBeenCalled();
    expect(deps.translate).not.toHaveBeenCalled();
  });

  it("refuses to generate before the English transcript exists", async () => {
    const { deps, rows } = fakePackDeps(async () => null);
    await expect(ensurePack("lec-1", "en", deps)).rejects.toBeInstanceOf(MissingTranscriptError);
    expect(rows).toHaveLength(0);
  });
});
