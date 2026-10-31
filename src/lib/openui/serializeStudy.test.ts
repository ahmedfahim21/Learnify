import { createParser } from "@openuidev/lang-core";
import { describe, expect, it } from "vitest";

import type { ViewPack } from "@/lib/lectures/view";
import { layoutConcepts } from "@/lib/study/layout";

import { serializeStudy } from "./serializeStudy";
import { studyLibrary } from "./studyLibrary";

const pack: ViewPack = {
  concepts: [
    { id: "stored-program", title: "Stored program", summary: 'Programs live in memory, "like data".', startSec: 10, endSec: 90, prereqIds: [] },
    { id: "cpu", title: "CPU = CU + ALU", summary: "நினைவகம் மற்றும் \\ backslash", startSec: 300.456, endSec: 340, prereqIds: ["stored-program"] },
  ],
  checkpoints: [],
  flashcards: [
    { id: "a1b2c3d4e5f60718", front: "What is ENIAC?", back: "The first digital computer", startSec: 55 },
    { id: "0f1e2d3c4b5a6978", front: "Line\nbreak?", back: "Yes", startSec: 60 },
  ],
  recap: { summary: "Computers run stored programs.", keyPoints: [{ text: "Memory holds code", startSec: 60 }] },
};

const parse = (text: string) => createParser(studyLibrary.toJSONSchema()).parse(text);
type El = { typeName: string; props: Record<string, unknown> };
const children = (el: El, key: string) => el.props[key] as El[];

describe("serializeStudy", () => {
  const programs = serializeStudy(pack);

  it.each(["map", "cards", "recap"] as const)("%s parses cleanly against the study library", (tab) => {
    const result = parse(programs[tab]);
    expect(result.root?.typeName).toBe("Study");
    expect(result.meta.errors).toEqual([]);
    expect(result.meta.unresolved).toEqual([]);
    expect(result.meta.orphaned).toEqual([]);
    expect(result.meta.incomplete).toBe(false);
  });

  it("round-trips every concept field, including quotes, backslashes and Tamil", () => {
    const root = parse(programs.map).root as unknown as El;
    const map = children(root, "parts")[0];
    expect(map.typeName).toBe("ConceptMap");
    expect(children(map, "concepts").map((n) => n.props)).toEqual([
      { id: "stored-program", title: "Stored program", summary: 'Programs live in memory, "like data".', startSec: 10, endSec: 90, prereqIds: [] },
      { id: "cpu", title: "CPU = CU + ALU", summary: "நினைவகம் மற்றும் \\ backslash", startSec: 300.46, endSec: 340, prereqIds: ["stored-program"] },
    ]);
  });

  it("round-trips flashcards, newlines included", () => {
    const deck = children(parse(programs.cards).root as unknown as El, "parts")[0];
    expect(children(deck, "cards").map((n) => n.props)).toEqual([
      { id: "a1b2c3d4e5f60718", front: "What is ENIAC?", back: "The first digital computer", startSec: 55 },
      { id: "0f1e2d3c4b5a6978", front: "Line\nbreak?", back: "Yes", startSec: 60 },
    ]);
  });

  it("round-trips the recap", () => {
    const recap = children(parse(programs.recap).root as unknown as El, "parts")[0];
    expect(recap.props.summary).toBe("Computers run stored programs.");
    expect(children(recap, "points").map((n) => n.props)).toEqual([{ text: "Memory holds code", startSec: 60 }]);
  });

  it("produces valid empty screens for a pack with no cards or points", () => {
    const empty = serializeStudy({ ...pack, flashcards: [], recap: { summary: "s", keyPoints: [] } });
    expect(parse(empty.cards).meta.errors).toEqual([]);
    expect(parse(empty.recap).meta.errors).toEqual([]);
  });
});

describe("layoutConcepts", () => {
  it("puts each concept one level below its deepest prerequisite, centred under the widest level", () => {
    const placed = layoutConcepts([
      { id: "a", prereqIds: [] },
      { id: "b", prereqIds: ["a"] },
      { id: "c", prereqIds: [] },
      { id: "d", prereqIds: ["b", "c"] },
    ]);
    expect(placed).toEqual([
      { id: "a", level: 0, order: 0, x: 0, y: 0 },
      { id: "b", level: 1, order: 0, x: 95, y: 110 },
      { id: "c", level: 0, order: 1, x: 190, y: 0 },
      { id: "d", level: 2, order: 0, x: 95, y: 220 },
    ]);
  });

  it("ignores unknown and self prerequisites, and terminates on a cycle", () => {
    const placed = layoutConcepts([
      { id: "a", prereqIds: ["ghost", "a"] },
      { id: "b", prereqIds: ["c"] },
      { id: "c", prereqIds: ["b"] },
    ]);
    expect(placed.find((p) => p.id === "a")?.level).toBe(0);
    expect(placed).toHaveLength(3);
  });
});
