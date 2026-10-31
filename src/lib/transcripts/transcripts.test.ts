import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchNptelVtt, VttFetchError, vttDownloadUrl } from "./nptelVtt";
import { mergeCues, segmentAt, segmentsBetween } from "./merge";
import { parseTimestamp, parseVtt, VttParseError } from "./vtt";

const fixture = (name: string) => readFileSync(join(__dirname, "__fixtures__", name), "utf8");

describe("parseTimestamp", () => {
  it("reads mm:ss.mmm, hh:mm:ss.mmm and comma decimals", () => {
    expect(parseTimestamp("00:16.640")).toBe(16.64);
    expect(parseTimestamp("01:02:03.500")).toBe(3723.5);
    expect(parseTimestamp("00:01,250")).toBe(1.25);
  });
});

describe("parseVtt", () => {
  it("parses a real NPTEL English track", () => {
    const cues = parseVtt(fixture("nptel-en.vtt"));
    expect(cues[0]).toEqual({
      startSec: 0.87,
      endSec: 16.64,
      text: "Welcome to this online course on programming, I am Shankar Balachandran from the Computer",
    });
    expect(cues[1]).toEqual({
      startSec: 16.64,
      endSec: 20.69,
      text: "Science Engineering Department at IIT, Madras.",
    });
  });

  it("parses a real NPTEL Tamil track", () => {
    const cues = parseVtt(fixture("nptel-ta.vtt"));
    expect(cues[0].startSec).toBe(0.55);
    expect(cues[0].text).toBe("ப்ரொக்ராமிங் குறித்த இந்த ஆன்லைன் படிப்புக்கு");
  });

  it("skips NOTE blocks, cue ids, settings and inline tags; decodes entities", () => {
    const body = [
      "WEBVTT",
      "",
      "NOTE produced by hand",
      "",
      "intro-1",
      "00:00:01.000 --> 00:00:02.000 align:start",
      "<v Prof>it&#39;s n &lt; m</v>",
    ].join("\n");
    expect(parseVtt(body)).toEqual([{ startSec: 1, endSec: 2, text: "it's n < m" }]);
  });

  it("returns no cues for a header-only file", () => {
    expect(parseVtt("WEBVTT\n")).toEqual([]);
  });

  it("rejects an HTML page masquerading as a caption file", () => {
    expect(() => parseVtt("<!DOCTYPE html><html>quota exceeded</html>")).toThrow(VttParseError);
  });
});

describe("mergeCues", () => {
  it("joins mid-sentence NPTEL cues into one sentence segment", () => {
    const segments = mergeCues(parseVtt(fixture("nptel-en.vtt")));
    expect(segments[0]).toEqual({
      i: 0,
      startSec: 0.87,
      endSec: 20.69,
      text: "Welcome to this online course on programming, I am Shankar Balachandran from the Computer Science Engineering Department at IIT, Madras.",
    });
    expect(segments.every((s, idx) => s.i === idx)).toBe(true);
  });

  it("splits when a sentence runs past maxSec", () => {
    const cues = [
      { startSec: 0, endSec: 5, text: "one" },
      { startSec: 5, endSec: 10, text: "two" },
      { startSec: 10, endSec: 15, text: "three." },
    ];
    expect(mergeCues(cues, { maxSec: 12 }).map((s) => s.text)).toEqual(["one two", "three."]);
  });

  it("ends sentences on ? ! and the Indic danda", () => {
    const cues = [
      { startSec: 0, endSec: 1, text: "why n?" },
      { startSec: 1, endSec: 2, text: "यह सही है।" },
      { startSec: 2, endSec: 3, text: "yes!" },
    ];
    expect(mergeCues(cues)).toHaveLength(3);
  });

  it("keeps a trailing fragment with no final punctuation", () => {
    const cues = [{ startSec: 0, endSec: 2, text: "and so on" }];
    expect(mergeCues(cues)).toEqual([{ i: 0, startSec: 0, endSec: 2, text: "and so on" }]);
  });

  it("orders unsorted cues and takes the latest end of overlapping ones", () => {
    const cues = [
      { startSec: 2, endSec: 3, text: "world." },
      { startSec: 0, endSec: 4, text: "hello" },
    ];
    expect(mergeCues(cues)).toEqual([{ i: 0, startSec: 0, endSec: 4, text: "hello world." }]);
  });
});

describe("segmentAt / segmentsBetween", () => {
  const segs = [
    { i: 0, startSec: 1, endSec: 3, text: "a" },
    { i: 1, startSec: 3, endSec: 5, text: "b" },
    { i: 2, startSec: 8, endSec: 9, text: "c" },
  ];

  it("finds the showing segment, and -1 before, in gaps and after", () => {
    expect(segmentAt(segs, 0.5)).toBe(-1);
    expect(segmentAt(segs, 1)).toBe(0);
    expect(segmentAt(segs, 3)).toBe(1);
    expect(segmentAt(segs, 6)).toBe(-1);
    expect(segmentAt(segs, 8.5)).toBe(2);
    expect(segmentAt(segs, 9)).toBe(-1);
  });

  it("returns segments overlapping a window", () => {
    expect(segmentsBetween(segs, 4, 8.5).map((s) => s.i)).toEqual([1, 2]);
  });
});

describe("fetchNptelVtt", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps Drive ids and SWAYAM gs:// paths to fixed URLs", () => {
    expect(vttDownloadUrl("1ef5G3pl4xZRWLkULHwOJ9q")).toBe(
      "https://drive.google.com/uc?export=download&id=1ef5G3pl4xZRWLkULHwOJ9q",
    );
    expect(vttDownloadUrl("gs://swayam-node1-production.appspot.com/assets/vtt/noc25_cs147/Kannada/Lec-01.vtt")).toBe(
      "https://storage.googleapis.com/swayam-node1-production.appspot.com/assets/vtt/noc25_cs147/Kannada/Lec-01.vtt",
    );
  });

  it.each([
    "../../etc?x=1",
    "gs://some-other-bucket/assets/x.vtt",
    "gs://swayam-node1-production.appspot.com/../secret.vtt",
    "gs://swayam-node1-production.appspot.com/assets/x.json",
    "https://evil.test/x.vtt",
  ])("refuses a reference that could shape the URL: %s", (ref) => {
    expect(() => vttDownloadUrl(ref)).toThrow(VttFetchError);
  });

  it("returns the body when it is WebVTT", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("WEBVTT\n\n00:01.000 --> 00:02.000\nhi")));
    await expect(fetchNptelVtt("1ef5G3pl4xZRWLkULHwOJ9q")).resolves.toMatch(/^WEBVTT/);
  });

  it("rejects Drive's HTML interstitial served with HTTP 200", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>Google Drive quota</html>")));
    await expect(fetchNptelVtt("1ef5G3pl4xZRWLkULHwOJ9q")).rejects.toThrow(/not WebVTT/);
  });

  it("follows Drive's redirect to drive.usercontent.google.com", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 303,
          headers: { location: "https://drive.usercontent.google.com/download?id=abcdefghijk" },
        }),
      )
      .mockResolvedValueOnce(new Response("WEBVTT\n"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchNptelVtt("1ef5G3pl4xZRWLkULHwOJ9q")).resolves.toBe("WEBVTT\n");
    expect(fetchMock.mock.calls[1][0]).toBe("https://drive.usercontent.google.com/download?id=abcdefghijk");
  });

  it("refuses redirects off Google hosts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://evil.test/x" } })),
    );
    await expect(fetchNptelVtt("1ef5G3pl4xZRWLkULHwOJ9q")).rejects.toThrow(/foreign host/);
  });

  it("surfaces HTTP failures with the status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    await expect(fetchNptelVtt("1ef5G3pl4xZRWLkULHwOJ9q")).rejects.toThrow(/HTTP 429/);
  });
});
