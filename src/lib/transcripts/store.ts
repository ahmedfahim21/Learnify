import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { type Lecture, lectures, type NewTranscript, type Transcript, transcripts } from "@/db/schema";
import type { Lang } from "@/lib/languages";
import { translateSegments } from "@/lib/sarvam/translateSegments";

import { fetchNptelVtt } from "./nptelVtt";
import { type Resolved, resolveEnglish, resolveLanguage, type TranscriptSources } from "./resolve";
import { fetchYouTubeCues } from "./youtube";

/**
 * A lecture's subtitles in one language, built once and cached in Postgres.
 *
 * English is resolved first because every other language either checks its
 * timing against it or is translated from it. Saving is insert-or-keep, so
 * two requests building the same track both end up with the same stored row.
 * (Coordinating them so only one does the work is the job layer's concern.)
 */

export interface TranscriptDeps {
  getLecture: (lectureId: string) => Promise<Lecture | null>;
  getStored: (lectureId: string, lang: Lang) => Promise<Transcript | null>;
  /** Insert unless a row exists; return whichever row is stored. */
  save: (row: NewTranscript) => Promise<Transcript>;
  sources: TranscriptSources;
}

export const MACHINE_TRANSLATOR = "mayura:v1";

export const liveSources: TranscriptSources = {
  nptelVtt: fetchNptelVtt,
  youtubeCues: fetchYouTubeCues,
  translate: async (english, lang, tag) => ({
    segments: await translateSegments(english, lang, { translator: "mayura", tag }),
    model: MACHINE_TRANSLATOR,
  }),
};

export const dbDeps: TranscriptDeps = {
  getLecture: async (lectureId) => {
    const [row] = await getDb().select().from(lectures).where(eq(lectures.id, lectureId));
    return row ?? null;
  },
  getStored: async (lectureId, lang) => {
    const [row] = await getDb()
      .select()
      .from(transcripts)
      .where(and(eq(transcripts.lectureId, lectureId), eq(transcripts.lang, lang)));
    return row ?? null;
  },
  save: async (row) => {
    const [inserted] = await getDb().insert(transcripts).values(row).onConflictDoNothing().returning();
    if (inserted) return inserted;
    const [existing] = await getDb()
      .select()
      .from(transcripts)
      .where(and(eq(transcripts.lectureId, row.lectureId), eq(transcripts.lang, row.lang)));
    return existing;
  },
  sources: liveSources,
};

export class LectureNotFoundError extends Error {
  constructor(readonly lectureId: string) {
    super(`No lecture ${lectureId}`);
    this.name = "LectureNotFoundError";
  }
}

function toRow(lectureId: string, lang: Lang, r: Resolved): NewTranscript {
  return { lectureId, lang, source: r.source, segments: r.segments, durationSec: r.durationSec, model: r.model };
}

function toResolved(t: Transcript): Resolved {
  return { source: t.source, segments: t.segments, durationSec: t.durationSec, model: t.model, attempts: [] };
}

/** Report fallbacks so a lecture quietly running on YouTube captions or machine Tamil is traceable. */
function logFallbacks(lectureId: string, lang: Lang, r: Resolved) {
  if (r.attempts.length) console.warn(`transcript ${lectureId}/${lang} from ${r.source}; ${r.attempts.join("; ")}`);
}

export async function ensureTranscript(
  lectureId: string,
  lang: Lang,
  deps: TranscriptDeps = dbDeps,
): Promise<Transcript> {
  const stored = await deps.getStored(lectureId, lang);
  if (stored) return stored;

  const lecture = await deps.getLecture(lectureId);
  if (!lecture) throw new LectureNotFoundError(lectureId);

  let english = await deps.getStored(lectureId, "en");
  if (!english) {
    const resolved = await resolveEnglish(lecture, deps.sources);
    logFallbacks(lectureId, "en", resolved);
    english = await deps.save(toRow(lectureId, "en", resolved));
  }
  if (lang === "en") return english;

  const resolved = await resolveLanguage(lecture, lang, toResolved(english), deps.sources, `lecture ${lectureId}/${lang}`);
  logFallbacks(lectureId, lang, resolved);
  return deps.save(toRow(lectureId, lang, resolved));
}
