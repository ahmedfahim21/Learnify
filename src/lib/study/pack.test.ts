import { describe, expect, it } from "vitest";

import { normalisePack, snapReplays, type StudyPack, studyPackJsonSchema, validatePack } from "./pack";

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

describe("normalisePack", () => {
  // 10-second sentences, so replay ends snap to the next boundary.
  const segs = Array.from({ length: 100 }, (_, n) => ({ startSec: n * 10, endSec: n * 10 + 10 }));
  const withCheck = (over: Partial<StudyPack["checkpoints"][number]>): StudyPack => {
    const p = pack();
    p.checkpoints[0] = { ...p.checkpoints[0], ...over };
    return p;
  };

  it("cuts a replay that runs past its check", () => {
    const { pack: out, repairs } = normalisePack(withCheck({ atSec: 310, replayFrom: 250, replayTo: 330 }), segs);
    expect(out.checkpoints[0]).toMatchObject({ replayFrom: 250, replayTo: 310 });
    expect(repairs).toContain("c1: replay ended 20s after the check; cut at the check");
  });

  it("turns a reversed or too-short replay into the 60s before its end", () => {
    // 280 snaps to the end of its sentence (290); 300 snaps to 310, the check.
    expect(normalisePack(withCheck({ atSec: 310, replayFrom: 300, replayTo: 280 }), segs).pack.checkpoints[0]).toMatchObject({
      replayFrom: 220,
      replayTo: 290,
    });
    expect(normalisePack(withCheck({ atSec: 310, replayFrom: 296, replayTo: 300 }), segs).pack.checkpoints[0]).toMatchObject({
      replayFrom: 240,
      replayTo: 310,
    });
  });

  it("keeps the last 150s of an over-long replay", () => {
    expect(normalisePack(withCheck({ atSec: 400, replayFrom: 20, replayTo: 400 }), segs).pack.checkpoints[0]).toMatchObject({
      replayFrom: 250,
      replayTo: 400,
    });
  });

  it("leaves a good replay's start alone and reports no replay repair", () => {
    const { pack: out, repairs } = normalisePack(pack(), segs);
    expect(out.checkpoints[0]).toMatchObject({ replayFrom: 200, replayTo: 310 });
    expect(repairs.filter((r) => r.includes("replay"))).toEqual([]);
  });

  it("strips letter labels and shuffles options, keeping the same right answer", () => {
    const p = withCheck({ options: ["A) zero", "B) one", "C) two", "D) three"], answerIndex: 1 });
    const { pack: out, repairs } = normalisePack(p, segs);
    const cp = out.checkpoints[0];
    expect([...cp.options].sort()).toEqual(["one", "three", "two", "zero"]);
    expect(cp.options[cp.answerIndex]).toBe("one");
    expect(repairs).toContain("c1: stripped letter labels from options");
  });

  it("shuffles deterministically, and doesn't pin every answer to one slot", () => {
    const a = normalisePack(pack(), segs).pack.checkpoints[0];
    const b = normalisePack(pack(), segs).pack.checkpoints[0];
    expect(a).toEqual(b);
    const slots = new Set(
      Array.from({ length: 12 }, (_, n) => normalisePack(withCheck({ id: `k${n}`, answerIndex: 1 }), segs).pack.checkpoints[0].answerIndex),
    );
    expect(slots.size).toBeGreaterThan(1);
  });

  it("moves a check that fires long after its explanation to the end of the replay", () => {
    const { pack: out, repairs } = normalisePack(withCheck({ atSec: 900, replayFrom: 240, replayTo: 300 }), segs);
    expect(out.checkpoints[0]).toMatchObject({ atSec: 310, replayFrom: 240, replayTo: 310 });
    expect(repairs).toContain("c1: fired 590s after its explanation; moved to 310s");
    expect(validatePack(out, { durationSec: 1000, segments: segs }).filter((e) => e.includes("after its explanation"))).toEqual([]);
  });

  it("changes nothing outside checkpoints", () => {
    const p = pack();
    const out = normalisePack(p, segs).pack;
    expect(out.concepts).toEqual(p.concepts);
    expect(out.flashcards).toEqual(p.flashcards);
    expect(out.recap).toEqual(p.recap);
  });
});
