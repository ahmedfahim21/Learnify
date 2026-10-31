import { describe, expect, it } from "vitest";

import { snapReplays, type StudyPack, studyPackJsonSchema, validatePack } from "./pack";

const ctx = {
  durationSec: 1000,
  segments: [
    { startSec: 0, endSec: 400 },
    { startSec: 420, endSec: 1000 },
  ],
};

function pack(): StudyPack {
  return {
    concepts: [
      { id: "a", title: "A", summary: "s", startSec: 10, endSec: 100, prereqIds: [] },
      { id: "b", title: "B", summary: "s", startSec: 120, endSec: 300, prereqIds: ["a"] },
    ],
    checkpoints: [
      {
        id: "c1",
        atSec: 310,
        conceptId: "b",
        question: "q",
        options: ["w", "x", "y", "z"],
        answerIndex: 2,
        explanation: "e",
        replayFrom: 200,
        replayTo: 300,
      },
    ],
    flashcards: [{ front: "f", back: "b", startSec: 50 }],
    recap: { summary: "s", keyPoints: [{ text: "k", startSec: 200 }] },
  };
}

describe("validatePack", () => {
  it("accepts a well-formed pack", () => {
    expect(validatePack(pack(), ctx)).toEqual([]);
  });

  it("flags times outside the lecture and times in silence", () => {
    const p = pack();
    p.flashcards[0].startSec = 1200;
    p.recap.keyPoints[0].startSec = 410;
    expect(validatePack(p, ctx)).toEqual([
      "flashcard 0 startSec: 1200s is outside the lecture (0–1000s)",
      "recap point 0 startSec: 410s does not land on any transcript segment",
    ]);
  });

  it("flags unknown and cyclic prerequisites", () => {
    const p = pack();
    p.concepts[0].prereqIds = ["b"];
    p.concepts[1].prereqIds = ["a", "ghost"];
    const errors = validatePack(p, ctx);
    expect(errors).toContain("concept b: unknown prerequisite ghost");
    expect(errors.some((e) => e.startsWith("prerequisite cycle: a → b → a"))).toBe(true);
  });

  it("flags a replay that re-plays far more than the explanation", () => {
    const p = pack();
    p.checkpoints[0].replayFrom = 20;
    expect(validatePack(p, ctx)).toEqual([
      "checkpoint c1: replay is 280s; keep it 10–150s around the explanation",
    ]);
  });

  it("flags every broken checkpoint rule", () => {
    const p = pack();
    p.checkpoints.push({
      ...p.checkpoints[0],
      id: "c2",
      atSec: 330,
      conceptId: "nope",
      options: ["x", "X", "y"],
      answerIndex: 5,
      replayFrom: 300,
      replayTo: 340,
    });
    expect(validatePack(p, ctx)).toEqual([
      "checkpoint c2: unknown concept nope",
      "checkpoint c2: needs exactly 4 options",
      "checkpoint c2: options are not distinct",
      "checkpoint c2: answerIndex 5 out of range",
      "checkpoint c2: replay must satisfy replayFrom < replayTo <= atSec",
      "checkpoint c2: less than 60s after the previous check",
    ]);
  });
});

describe("studyPackJsonSchema", () => {
  it("is an object schema with every top-level section required", () => {
    expect(studyPackJsonSchema.type).toBe("object");
    expect(studyPackJsonSchema.required).toEqual(["concepts", "checkpoints", "flashcards", "recap"]);
  });
});

describe("validatePack: check timing", () => {
  it("flags a check that fires long after its explanation", () => {
    const p = pack();
    p.checkpoints[0].atSec = 900;
    expect(validatePack(p, ctx)).toEqual(["checkpoint c1: fires 600s after its explanation; place it within 180s"]);
  });
});

describe("snapReplays", () => {
  it("extends replayTo to the end of the segment it lands in, never past the check", () => {
    const segs = [
      { startSec: 1200, endSec: 1246 },
      { startSec: 1246, endSec: 1276 },
    ];
    const p = pack();
    p.checkpoints[0] = { ...p.checkpoints[0], replayFrom: 1190, replayTo: 1246, atSec: 1300 };
    expect(snapReplays(p, segs).checkpoints[0].replayTo).toBe(1276);
    p.checkpoints[0].atSec = 1260;
    expect(snapReplays(p, segs).checkpoints[0].replayTo).toBe(1260);
  });

  it("changes nothing but replayTo", () => {
    const p = pack();
    const out = snapReplays(p, ctx.segments);
    expect({ ...out.checkpoints[0], replayTo: 0 }).toEqual({ ...p.checkpoints[0], replayTo: 0 });
    expect(out.concepts).toEqual(p.concepts);
    expect(out.flashcards).toEqual(p.flashcards);
  });
});
