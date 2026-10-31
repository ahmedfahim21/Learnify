/**
 * Minimal WebVTT parser for lecture captions.
 *
 * Handles what NPTEL and YouTube tracks actually contain: optional hours
 * (`mm:ss.mmm` and `hh:mm:ss.mmm`), optional cue identifiers, cue settings
 * after the timing line, multi-line cue text, inline tags, and the handful of
 * HTML entities caption tracks carry. NOTE/STYLE/REGION blocks are skipped.
 */

export interface Cue {
  startSec: number;
  endSec: number;
  text: string;
}

export class VttParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VttParseError";
  }
}

const TIMING =
  /^((?:\d+:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)\s+-->\s+((?:\d+:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)/;

export function parseTimestamp(raw: string): number {
  const parts = raw.replace(",", ".").split(":");
  let sec = 0;
  for (const part of parts) sec = sec * 60 + Number(part);
  if (!Number.isFinite(sec)) throw new VttParseError(`Bad VTT timestamp "${raw}"`);
  return Math.round(sec * 1000) / 1000;
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&amp;#39;|&#39;/g, "'")
    .replace(/&amp;quot;|&quot;/g, '"')
    .replace(/&amp;amp;|&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function cleanText(lines: string[]): string {
  return decodeEntities(lines.join(" ").replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

export function parseVtt(body: string): Cue[] {
  const text = body.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (!text.startsWith("WEBVTT")) {
    throw new VttParseError("Not a WebVTT file (missing WEBVTT header)");
  }

  const cues: Cue[] = [];
  for (const block of text.split(/\n{2,}/).slice(1)) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    if (lines.length === 0) continue;
    if (/^(NOTE|STYLE|REGION)\b/.test(lines[0])) continue;

    const timingIndex = lines.findIndex((l) => TIMING.test(l));
    if (timingIndex === -1) continue;
    const [, start, end] = lines[timingIndex].match(TIMING)!;
    const cueText = cleanText(lines.slice(timingIndex + 1));
    if (!cueText) continue;

    cues.push({ startSec: parseTimestamp(start), endSec: parseTimestamp(end), text: cueText });
  }
  return cues;
}
