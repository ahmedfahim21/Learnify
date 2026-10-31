import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  decodeCourseList,
  decodeCourseOutline,
  NptelFormatError,
  unflatten,
} from "./decode";

const fixture = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, "__fixtures__", name), "utf8")) as unknown;

describe("unflatten", () => {
  it("resolves index references, including shared ones", () => {
    const flat = [{ a: 1, b: 1 }, { x: 2 }, "hi"];
    const out = unflatten(flat) as { a: { x: string }; b: { x: string } };
    expect(out).toEqual({ a: { x: "hi" }, b: { x: "hi" } });
    expect(out.a).toBe(out.b);
  });

  it("maps negative indices to undefined", () => {
    expect(unflatten([{ a: -1 }])).toEqual({ a: undefined });
  });

  it("refuses devalue custom types instead of guessing", () => {
    expect(() => unflatten([["Date", "2026-01-01"]])).toThrow(NptelFormatError);
  });
});

describe("decodeCourseList", () => {
  it("decodes every course field and discipline", () => {
    const list = decodeCourseList(fixture("courses-sample.json"));
    expect(list.courses).toHaveLength(3);
    expect(list.courses[0]).toEqual({
      id: 101101079,
      title: "NOC:Introduction to Aerospace Engineering",
      professor: "Prof. Rajkumar S. Pant",
      instituteName: "IIT Bombay",
      contentType: "Video",
      disciplineId: 101,
    });
    expect(list.disciplines[0]).toEqual({ id: "101", name: "Aerospace Engineering" });
  });

  it("fails loudly with the broken path when the shape changes", () => {
    const body = { type: "data", nodes: [null, { type: "data", data: [{ courses: 1 }, "nope"] }] };
    expect(() => decodeCourseList(body)).toThrow(/NPTEL data format changed: course list: courses/);
  });

  it("rejects a body that isn't a SvelteKit data payload", () => {
    expect(() => decodeCourseList({ hello: "world" })).toThrow(NptelFormatError);
  });
});

describe("decodeCourseOutline", () => {
  const outline = decodeCourseOutline(fixture("outline-106106127.json"));

  it("decodes course metadata", () => {
    expect(outline.title).toBe("Programming, Data Structures and Algorithms using C");
    expect(outline.instituteName).toBe("IIT Madras");
    expect(outline.contentType).toBe("Video");
  });

  it("flattens units into ordered lessons with youtube ids and only existing VTT tracks", () => {
    expect(outline.lessons).toHaveLength(61);
    expect(outline.lessons[0]).toEqual({
      id: 1,
      unitName: "Basic Programming Constructs",
      title: "Introduction to Computers and Programming",
      youtubeId: "DYFhgnaZCRE",
      conceptsCovered: null,
      vttIds: {
        English: "1ef5G3pl4xZRWLkULHwOJ9q_0P0u54SCh",
        Hindi: "10AzOdKS6m68typqWrnDXAWUeJ2NXWi1C",
        Malayalam: "1UNwuHNDH_K4IB86pGIZngpZHM4zQx9xs",
        Tamil: "1ZXj7zNSBlOzEwNUfRcG2Qgaawu--xVdY",
        Telugu: "14PleOFNjUcq-V2iKfHJR5i7x_SzHsWDS",
      },
    });
    expect(outline.lessons.every((l) => l.youtubeId !== null)).toBe(true);
  });
});
