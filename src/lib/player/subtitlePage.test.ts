import { describe, expect, it } from "vitest";

import { pageAt, pages } from "./subtitlePage";

describe("pages", () => {
  it("keeps short text whole and splits long text at word boundaries", () => {
    expect(pages("one two", 20)).toEqual(["one two"]);
    expect(pages("aaa bbb ccc ddd eee", 8)).toEqual(["aaa bbb", "ccc ddd", "eee"]);
  });

  it("never splits inside a word, even a long Indic one", () => {
    const word = "வரவேற்கிறோம்";
    expect(pages(`${word} ${word}`, 5)).toEqual([word, word]);
  });

  it("returns one empty page for empty text", () => {
    expect(pages("  ", 10)).toEqual([""]);
  });
});

describe("pageAt", () => {
  const text = "aaa bbb ccc ddd"; // pages of 8: "aaa bbb", "ccc ddd"

  it("shows each page for its share of the segment's time", () => {
    expect(pageAt(text, 10, 20, 10, 8)).toBe("aaa bbb");
    expect(pageAt(text, 10, 20, 14.9, 8)).toBe("aaa bbb");
    expect(pageAt(text, 10, 20, 15.1, 8)).toBe("ccc ddd");
    expect(pageAt(text, 10, 20, 19.9, 8)).toBe("ccc ddd");
  });

  it("clamps outside the segment and handles a zero-length one", () => {
    expect(pageAt(text, 10, 20, 5, 8)).toBe("aaa bbb");
    expect(pageAt(text, 10, 20, 25, 8)).toBe("ccc ddd");
    expect(pageAt(text, 10, 10, 10, 8)).toBe("aaa bbb");
  });

  it("returns short text as is", () => {
    expect(pageAt("hello", 0, 5, 3, 80)).toBe("hello");
  });
});
