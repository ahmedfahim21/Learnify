import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { decodeCourseList, decodeCourseOutline, type NptelLesson } from "@/lib/nptel/decode";

import { humanLangsOf, scoreForShelf, toCourseRows, toLectureRows } from "./repo";

const fixture = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, "../nptel/__fixtures__", name), "utf8")) as unknown;

describe("toCourseRows", () => {
  it("maps every field and resolves the discipline name", () => {
    const now = new Date("2026-10-31T00:00:00Z");
    const rows = toCourseRows(decodeCourseList(fixture("courses-sample.json")), now);
    expect(rows[0]).toEqual({
      id: 101101079,
      title: "NOC:Introduction to Aerospace Engineering",
      professor: "Prof. Rajkumar S. Pant",
      institute: "IIT Bombay",
      disciplineId: 101,
      disciplineName: "Aerospace Engineering",
      contentType: "Video",
      syncedAt: now,
    });
  });

  it("collapses NPTEL's doubled spaces in names", () => {
    const rows = toCourseRows({
      courses: [{ id: 1, title: " T ", professor: "Prof.  Hema A Murthy", instituteName: "IIT Madras", contentType: "Video", disciplineId: 106 }],
      disciplines: [{ id: "106", name: "Computer Science and  Engineering" }],
    });
    expect(rows[0]).toMatchObject({ title: "T", professor: "Prof. Hema A Murthy", disciplineName: "Computer Science and Engineering" });
  });

  it("refuses a course whose discipline isn't in the list", () => {
    expect(() =>
      toCourseRows({
        courses: [{ id: 1, title: "T", professor: "P", instituteName: "I", contentType: "Video", disciplineId: 999 }],
        disciplines: [],
      }),
    ).toThrow(/unknown discipline 999/);
  });
});

describe("humanLangsOf", () => {
  const lesson = (id: number, langs: string[], youtubeId: string | null = "DYFhgnaZCRE"): NptelLesson => ({
    id,
    unitName: "U",
    title: `L${id}`,
    youtubeId,
    conceptsCovered: null,
    vttIds: Object.fromEntries(langs.map((l) => [l, `ref-${l}-${id}`])),
  });

  it("finds the human tracks on the real PDSA course", () => {
    const outline = decodeCourseOutline(fixture("outline-106106127.json"));
    // 61 lessons: English 60, Tamil 60, Telugu 60, Hindi 59, Malayalam 59.
    expect(humanLangsOf(outline.lessons)).toEqual(["hi", "ta", "te", "ml"]);
  });

  it("needs a track on at least half the playable lectures", () => {
    const lessons = [lesson(1, ["English", "Tamil"]), lesson(2, ["English", "Tamil"]), lesson(3, ["English", "Hindi"]), lesson(4, ["English"])];
    expect(humanLangsOf(lessons)).toEqual(["ta"]);
  });

  it("ignores lessons with no video, and Odia uses NPTEL's 'Odiya' spelling", () => {
    const lessons = [lesson(1, ["Odiya"]), lesson(2, ["Tamil"], null)];
    expect(humanLangsOf(lessons)).toEqual(["od"]);
  });

  it("returns nothing for a course with no playable lectures", () => {
    expect(humanLangsOf([lesson(1, ["Tamil"], null)])).toEqual([]);
  });
});

describe("toLectureRows", () => {
  it("maps every lesson field onto a lecture row", () => {
    const outline = decodeCourseOutline(fixture("outline-106106127.json"));
    const rows = toLectureRows(106106127, outline.lessons);
    expect(rows).toHaveLength(61);
    expect(rows.map((r) => r.position)).toEqual([...Array(61).keys()]);
    expect(rows[0]).toEqual({
      courseId: 106106127,
      position: 0,
      nptelLessonId: 1,
      unitName: "Basic Programming Constructs",
      title: "Introduction to Computers and Programming",
      youtubeId: "DYFhgnaZCRE",
      conceptsCovered: null,
      vttRefs: outline.lessons[0].vttIds,
    });
  });
});

describe("toLectureRows: repeated NPTEL lesson ids", () => {
  it("keys by position, so a restarted id (Basic Calculus' Live Session unit) can't collide", () => {
    const lessons: NptelLesson[] = [
      { id: 1, unitName: "Week 1", title: "The Real line - Part 1", youtubeId: "suv-iQnlETc", conceptsCovered: null, vttIds: {} },
      { id: 1, unitName: "Live Session", title: "Live Session 03-03-2021", youtubeId: null, conceptsCovered: null, vttIds: {} },
    ];
    const rows = toLectureRows(111106146, lessons);
    expect(rows.map((r) => [r.position, r.nptelLessonId])).toEqual([
      [0, 1],
      [1, 1],
    ]);
  });
});

describe("scoreForShelf", () => {
  const lesson = (id: number, langs: string[], youtubeId: string | null = "DYFhgnaZCRE"): NptelLesson => ({
    id,
    unitName: "U",
    title: `L${id}`,
    youtubeId,
    conceptsCovered: null,
    vttIds: Object.fromEntries(langs.map((l) => [l, `ref-${l}`])),
  });

  it("ranks human subtitle languages first, then starter disciplines", () => {
    const withTamil = Array.from({ length: 10 }, (_, n) => lesson(n, ["English", "Tamil"]));
    const englishOnly = Array.from({ length: 10 }, (_, n) => lesson(n, ["English"]));
    expect(scoreForShelf(106, withTamil)).toEqual({ eligible: true, score: 14, coverage: 1, humanLangs: ["ta"] });
    expect(scoreForShelf(122, englishOnly).score).toBe(5);
    expect(scoreForShelf(101, englishOnly).score).toBe(0);
  });

  it("prefers introductory titles and pushes clearly advanced ones down", () => {
    const englishOnly = Array.from({ length: 10 }, (_, n) => lesson(n, ["English"]));
    expect(scoreForShelf(111, englishOnly, "NOC:Basic Linear Algebra").score).toBe(9);
    expect(scoreForShelf(111, englishOnly, "NOC:Linear Algebra").score).toBe(3);
    expect(scoreForShelf(115, englishOnly, "NOC:Path Integral and functional methods in quantum field theory").score).toBe(-14);
  });

  it("needs 90% of lectures playable with English captions", () => {
    const lessons = [...Array.from({ length: 8 }, (_, n) => lesson(n, ["English"])), lesson(8, []), lesson(9, ["English"], null)];
    expect(scoreForShelf(106, lessons)).toMatchObject({ eligible: false, coverage: 0.8 });
    expect(scoreForShelf(106, []).eligible).toBe(false);
  });

  it("scores the real PDSA course as eligible with four human languages", () => {
    const outline = decodeCourseOutline(fixture("outline-106106127.json"));
    expect(scoreForShelf(106, outline.lessons, outline.title)).toMatchObject({ eligible: true, humanLangs: ["hi", "ta", "te", "ml"], score: 50 });
  });
});
