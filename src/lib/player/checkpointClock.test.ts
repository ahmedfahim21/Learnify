import { describe, expect, it } from "vitest";

import { type ClockSample, dueCheckpoint, isNaturalPlayback, replayFinished } from "./checkpointClock";

const play = (prevSec: number, nowSec: number, over: Partial<ClockSample> = {}): ClockSample => ({
  prevSec,
  nowSec,
  elapsedMs: 250,
  playbackRate: 1,
  playing: true,
  msSinceOwnSeek: 60_000,
  ...over,
});

const checks = [
  { id: "k1", atSec: 120 },
  { id: "k2", atSec: 400 },
];

describe("dueCheckpoint", () => {
  it("fires when playback crosses a check", () => {
    expect(dueCheckpoint(play(119.9, 120.15), checks, new Set())).toEqual({ id: "k1", atSec: 120 });
  });

  it("fires exactly at the check time", () => {
    expect(dueCheckpoint(play(119.8, 120), checks, new Set())?.id).toBe("k1");
  });

  it("doesn't fire before or after the moment", () => {
    expect(dueCheckpoint(play(119, 119.25), checks, new Set())).toBeNull();
    expect(dueCheckpoint(play(120, 120.25), checks, new Set())).toBeNull();
  });

  it("never fires on a seek past the check", () => {
    expect(dueCheckpoint(play(100, 300), checks, new Set())).toBeNull();
    expect(dueCheckpoint(play(130, 110), checks, new Set())).toBeNull();
  });

  it("fires at 2x speed", () => {
    expect(dueCheckpoint(play(119.6, 120.1, { playbackRate: 2 }), checks, new Set())?.id).toBe("k1");
  });

  it("fires after a stalled sampler in a background tab", () => {
    // 4 s of wall clock passed, 4 s of video played.
    expect(dueCheckpoint(play(117, 121, { elapsedMs: 4000 }), checks, new Set())?.id).toBe("k1");
  });

  it("ignores a check already done", () => {
    expect(dueCheckpoint(play(119.9, 120.15), checks, new Set(["k1"]))).toBeNull();
  });

  it("stays quiet right after the player's own replay seek", () => {
    expect(dueCheckpoint(play(119.9, 120.15, { msSinceOwnSeek: 300 }), checks, new Set())).toBeNull();
  });

  it("doesn't fire while paused or buffering", () => {
    expect(dueCheckpoint(play(119.9, 120.15, { playing: false }), checks, new Set())).toBeNull();
  });
});

describe("isNaturalPlayback", () => {
  it("accepts small forward steps, rejects jumps and rewinds", () => {
    expect(isNaturalPlayback(play(10, 10.25))).toBe(true);
    expect(isNaturalPlayback(play(10, 12))).toBe(false);
    expect(isNaturalPlayback(play(10, 9.9))).toBe(false);
  });
});

describe("replayFinished", () => {
  it("is true once playback crosses the replay end naturally", () => {
    expect(replayFinished(play(89.9, 90.1), 90)).toBe(true);
    expect(replayFinished(play(80, 95), 90)).toBe(false);
    expect(replayFinished(play(85, 85.25), 90)).toBe(false);
  });
});
