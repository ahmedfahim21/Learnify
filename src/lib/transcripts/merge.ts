import type { Cue } from "./vtt";

/**
 * Merge caption cues into sentence segments.
 *
 * NPTEL cues break mid-sentence ("…I am Shankar Balachandran from the Computer
 * / Science Engineering Department…"). Translating fragments gives broken
 * grammar and subtitles that change mid-thought, so cues are merged until a
 * sentence ends or the segment would run past `maxSec`. A segment keeps its
 * first cue's start and its last cue's end.
 *
 * `maxSec` is 30, not shorter: single NPTEL cues already run ~16 s, so a
 * tighter cap would split real sentences. The subtitle bar paginates long
 * segments for display; translation still sees whole sentences.
 */

export interface Segment {
  /** Position in the lecture's segment list; the id translation aligns on. */
  i: number;
  startSec: number;
  endSec: number;
  text: string;
}

/** Latin sentence enders plus the Indic danda / double danda. */
const SENTENCE_END = /[.?!।॥]["')\]]*$/;

export interface MergeOptions {
  maxSec?: number;
}

export function mergeCues(cues: Cue[], { maxSec = 30 }: MergeOptions = {}): Segment[] {
  const sorted = [...cues].sort((a, b) => a.startSec - b.startSec);
  const segments: Segment[] = [];
  let buf: Cue[] = [];

  const flush = () => {
    if (buf.length === 0) return;
    const text = buf
      .map((c) => c.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) {
      segments.push({
        i: segments.length,
        startSec: buf[0].startSec,
        // Overlapping cues: the segment ends at the latest end seen.
        endSec: Math.max(...buf.map((c) => c.endSec)),
        text,
      });
    }
    buf = [];
  };

  for (const cue of sorted) {
    if (buf.length > 0 && cue.endSec - buf[0].startSec > maxSec) flush();
    buf.push(cue);
    if (SENTENCE_END.test(cue.text)) flush();
  }
  flush();
  return segments;
}

/** Index of the segment showing at `sec`, or -1 in a gap / outside the track. */
export function segmentAt(segments: Segment[], sec: number): number {
  let lo = 0;
  let hi = segments.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = segments[mid];
    if (sec < s.startSec) hi = mid - 1;
    else if (sec >= s.endSec) lo = mid + 1;
    else return mid;
  }
  return -1;
}

/** Segments overlapping `[fromSec, toSec]`, for grounding a doubt on what was just said. */
export function segmentsBetween(segments: Segment[], fromSec: number, toSec: number): Segment[] {
  return segments.filter((s) => s.endSec > fromSec && s.startSec < toSec);
}
