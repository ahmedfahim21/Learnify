import { getSubtitles } from "youtube-caption-extractor";

import { decodeEntities, type Cue } from "./vtt";

/**
 * English captions from the video's YouTube track — the fallback when NPTEL's
 * own caption file is missing or dead (Basic Calculus L1's Drive file 404s).
 * NPTEL uploads the same captions to YouTube, so the text and timings match.
 *
 * YouTube can block these requests from cloud IPs; a failure throws with the
 * reason so the caller can report every source it tried.
 */

const YOUTUBE_ID = /^[\w-]{11}$/;

export class YouTubeCaptionError extends Error {
  constructor(
    readonly videoId: string,
    reason: string,
  ) {
    super(`YouTube captions for ${videoId}: ${reason}`);
    this.name = "YouTubeCaptionError";
  }
}

export async function fetchYouTubeCues(videoId: string): Promise<Cue[]> {
  if (!YOUTUBE_ID.test(videoId)) throw new YouTubeCaptionError(videoId, "invalid video id");
  const subs = await getSubtitles({ videoID: videoId, lang: "en" });
  const cues: Cue[] = [];
  for (const s of subs) {
    const startSec = Number.parseFloat(s.start);
    const dur = Number.parseFloat(s.dur);
    const text = decodeEntities(s.text).replace(/\s+/g, " ").trim();
    if (!Number.isFinite(startSec) || !Number.isFinite(dur) || !text) continue;
    cues.push({ startSec, endSec: startSec + dur, text });
  }
  if (cues.length === 0) throw new YouTubeCaptionError(videoId, "no English captions");
  return cues;
}
