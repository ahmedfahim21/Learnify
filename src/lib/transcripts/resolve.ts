import { LANGUAGES, type Lang } from "@/lib/languages";

import { mergeCues, type Segment } from "./merge";
import { type Cue, parseVtt } from "./vtt";

/**
 * Where a lecture's subtitles come from, in order of preference.
 *
 * English: NPTEL's caption file, then the YouTube track. Another language:
 * NPTEL's human translation when it has one and its timing matches the
 * English, otherwise a machine translation of the English segments.
 *
 * The fetchers are passed in, so the chain is tested without the network and
 * the same code runs in the job, the spike and scripts.
 */

export interface TranscriptSources {
  nptelVtt: (ref: string) => Promise<string>;
  youtubeCues: (videoId: string) => Promise<Cue[]>;
  /** `tag` labels the Sarvam calls in logs, e.g. "lecture 325080ef/hi". */
  translate: (english: Segment[], lang: Lang, tag?: string) => Promise<{ segments: Segment[]; model: string }>;
}

export interface LectureRefs {
  youtubeId: string | null;
  vttRefs: Record<string, string>;
}

export interface Resolved {
  source: "nptel" | "youtube" | "sarvam";
  segments: Segment[];
  durationSec: number;
  model: string | null;
  /** What was tried and why it didn't work, for logs and the failure message. */
  attempts: string[];
}

export class TranscriptUnavailableError extends Error {
  constructor(
    readonly lang: Lang,
    readonly attempts: string[],
  ) {
    super(`No ${LANGUAGES[lang].name} transcript: ${attempts.join("; ")}`);
    this.name = "TranscriptUnavailableError";
  }
}

/** A human track whose length is off from the English by more than this is for a different cut. */
const MAX_DURATION_DRIFT = 0.1;

const durationOf = (segments: Segment[]) => Math.max(0, ...segments.map((s) => s.endSec));
const reason = (err: unknown) => (err instanceof Error ? err.message : String(err));

async function fromNptel(ref: string, sources: TranscriptSources): Promise<Segment[]> {
  const segments = mergeCues(parseVtt(await sources.nptelVtt(ref)));
  if (segments.length === 0) throw new Error("caption file has no cues");
  return segments;
}

export async function resolveEnglish(lecture: LectureRefs, sources: TranscriptSources): Promise<Resolved> {
  const attempts: string[] = [];

  const ref = lecture.vttRefs[LANGUAGES.en.nptelName];
  if (ref) {
    try {
      const segments = await fromNptel(ref, sources);
      return { source: "nptel", segments, durationSec: durationOf(segments), model: null, attempts };
    } catch (err) {
      attempts.push(`NPTEL caption file: ${reason(err)}`);
    }
  } else {
    attempts.push("NPTEL lists no English caption file");
  }

  if (lecture.youtubeId) {
    try {
      const segments = mergeCues(await sources.youtubeCues(lecture.youtubeId));
      if (segments.length === 0) throw new Error("caption track has no cues");
      return { source: "youtube", segments, durationSec: durationOf(segments), model: null, attempts };
    } catch (err) {
      attempts.push(`YouTube captions: ${reason(err)}`);
    }
  } else {
    attempts.push("lecture has no YouTube video");
  }

  throw new TranscriptUnavailableError("en", attempts);
}

export async function resolveLanguage(
  lecture: LectureRefs,
  lang: Lang,
  english: Resolved,
  sources: TranscriptSources,
  tag?: string,
): Promise<Resolved> {
  if (lang === "en") return english;
  const attempts: string[] = [];

  const ref = lecture.vttRefs[LANGUAGES[lang].nptelName];
  if (ref) {
    try {
      const segments = await fromNptel(ref, sources);
      const durationSec = durationOf(segments);
      const drift = Math.abs(durationSec - english.durationSec) / english.durationSec;
      if (drift > MAX_DURATION_DRIFT) {
        throw new Error(
          `runs ${Math.round(durationSec)}s against the English ${Math.round(english.durationSec)}s; likely a different cut`,
        );
      }
      return { source: "nptel", segments, durationSec, model: null, attempts };
    } catch (err) {
      attempts.push(`NPTEL ${LANGUAGES[lang].name} caption file: ${reason(err)}`);
    }
  }

  try {
    const { segments, model } = await sources.translate(english.segments, lang, tag);
    return { source: "sarvam", segments, durationSec: english.durationSec, model, attempts };
  } catch (err) {
    attempts.push(`machine translation: ${reason(err)}`);
    throw new TranscriptUnavailableError(lang, attempts);
  }
}
