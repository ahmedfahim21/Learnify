import { getSubtitles } from "youtube-caption-extractor";
import { fetchTranscript } from "youtube-transcript-plus";

import { estimateTokens, splitIntoChunks } from "./chunk";
import { type IngestedChunk, type IngestResult, SourceIngestError } from "./types";

/**
 * YouTube ingestion (#45): pull a video's transcript and chunk it with
 * `{ startSec, endSec }` timestamps so the citations UX (#46) can deep-link to
 * the exact moment.
 *
 * YouTube transcripts are fragile (captions disabled, region locks, datacenter
 * IP blocks), so we run a fallback chain — `youtube-caption-extractor` first,
 * `youtube-transcript-plus` second — and if both fail we raise a
 * {@link SourceIngestError} with `allowManualPaste`, letting the learner paste a
 * transcript by hand instead.
 */

/** A normalised transcript segment: text plus seconds-based timing. */
interface Segment {
  text: string;
  startSec: number;
  endSec: number;
}

/** How many segments to merge into one citable chunk (~a paragraph of speech). */
const SEGMENTS_PER_CHUNK = 12;

/** Extract the 11-char video id from any common YouTube URL (or a bare id). */
export function parseYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.slice(1, 12);
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host.endsWith("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      // /embed/ID, /shorts/ID, /live/ID
      const m = url.pathname.match(/\/(?:embed|shorts|live|v)\/([a-zA-Z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch {
    /* not a URL */
  }
  return null;
}

export async function ingestYouTube(rawUrl: string): Promise<IngestResult> {
  const videoId = parseYouTubeId(rawUrl);
  if (!videoId) {
    throw new SourceIngestError("That doesn't look like a YouTube video link.");
  }

  const segments = await fetchSegments(videoId);
  if (segments.length === 0) {
    throw new SourceIngestError(
      "No transcript is available for this video. You can paste the transcript manually instead.",
      { allowManualPaste: true },
    );
  }

  const title = (await fetchTitle(videoId)) ?? `YouTube video ${videoId}`;
  return buildResult(title, segments);
}

/**
 * Manual fallback: the learner pastes a transcript by hand. No timestamps, so
 * chunks carry `startSec: 0` — still teachable, just not deep-linkable.
 */
export async function ingestManualTranscript(
  rawUrl: string,
  transcript: string,
): Promise<IngestResult> {
  const text = transcript.trim();
  if (!text) {
    throw new SourceIngestError("The pasted transcript was empty.");
  }
  const videoId = parseYouTubeId(rawUrl);
  const title = (videoId && (await fetchTitle(videoId))) || "Pasted transcript";

  const chunks: IngestedChunk[] = splitIntoChunks(text).map((content) => ({
    content,
    metadata: { startSec: 0 },
  }));
  return { title, chunks, tokenEstimate: estimateTokens(text) };
}

/** Fallback chain: caption-extractor → transcript-plus. */
async function fetchSegments(videoId: string): Promise<Segment[]> {
  try {
    const subs = await getSubtitles({ videoID: videoId, lang: "en" });
    if (subs.length > 0) {
      return subs.map((s) => {
        const startSec = Number.parseFloat(s.start) || 0;
        const dur = Number.parseFloat(s.dur) || 0;
        return { text: s.text, startSec, endSec: startSec + dur };
      });
    }
  } catch {
    /* fall through to the second extractor */
  }

  try {
    const segs = await fetchTranscript(videoId, { lang: "en", retries: 1 });
    return segs.map((s) => ({
      text: s.text,
      startSec: s.offset,
      endSec: s.offset + s.duration,
    }));
  } catch {
    return [];
  }
}

/** Best-effort video title via YouTube's public oEmbed endpoint. */
async function fetchTitle(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: unknown };
    return typeof data.title === "string" ? data.title : null;
  } catch {
    return null;
  }
}

/** Merge segments into citable chunks, decoding entities and tracking timing. */
function buildResult(title: string, segments: Segment[]): IngestResult {
  const chunks: IngestedChunk[] = [];
  for (let i = 0; i < segments.length; i += SEGMENTS_PER_CHUNK) {
    const group = segments.slice(i, i + SEGMENTS_PER_CHUNK);
    const content = group
      .map((s) => decodeEntities(s.text).replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join(" ");
    if (!content) continue;
    chunks.push({
      content,
      metadata: {
        startSec: Math.round(group[0].startSec),
        endSec: Math.round(group[group.length - 1].endSec),
      },
    });
  }
  const tokenEstimate = estimateTokens(chunks.map((c) => c.content).join(" "));
  return { title, chunks, tokenEstimate };
}

/** Decode the handful of HTML entities YouTube caption tracks contain. */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;#39;|&#39;/g, "'")
    .replace(/&amp;quot;|&quot;/g, '"')
    .replace(/&amp;amp;|&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}
