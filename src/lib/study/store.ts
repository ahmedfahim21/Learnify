import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { type Lecture, type NewStudyPackRow, type StudyPackRow, studyPacks } from "@/db/schema";
import type { Lang } from "@/lib/languages";
import type { Segment } from "@/lib/transcripts/merge";
import { dbDeps as transcriptDeps } from "@/lib/transcripts/store";

import { generateStudyPack, packModel, STUDY_PROMPT_VERSION } from "./generate";
import type { StudyPack } from "./pack";
import { translatePack } from "./translatePack";

/**
 * A lecture's study pack in one language, built once and cached. English is
 * generated from the English transcript; other languages translate it.
 * Callers run the transcript stage first (lib/jobs/prepare.ts).
 */

export interface PackDeps {
  getLecture: (lectureId: string) => Promise<Lecture | null>;
  getEnglishSegments: (lectureId: string) => Promise<Segment[] | null>;
  getStored: (lectureId: string, lang: Lang) => Promise<StudyPackRow | null>;
  save: (row: NewStudyPackRow) => Promise<StudyPackRow>;
  generate: (title: string, segments: Segment[]) => Promise<{ pack: StudyPack; model: string }>;
  translate: (english: StudyPack, lang: Lang, tag: string) => Promise<StudyPack>;
}

/** Recorded on translated packs: the English pack's model, then the translator. */
const translatedBy = (english: string) => `${english}+mayura:v1`;

export const dbPackDeps: PackDeps = {
  getLecture: transcriptDeps.getLecture,
  getEnglishSegments: async (lectureId) => (await transcriptDeps.getStored(lectureId, "en"))?.segments ?? null,
  getStored: async (lectureId, lang) => {
    const [row] = await getDb()
      .select()
      .from(studyPacks)
      .where(
        and(
          eq(studyPacks.lectureId, lectureId),
          eq(studyPacks.lang, lang),
          eq(studyPacks.promptVersion, STUDY_PROMPT_VERSION),
        ),
      );
    return row ?? null;
  },
  save: async (row) => {
    const [inserted] = await getDb().insert(studyPacks).values(row).onConflictDoNothing().returning();
    if (inserted) return inserted;
    const [existing] = await getDb()
      .select()
      .from(studyPacks)
      .where(
        and(
          eq(studyPacks.lectureId, row.lectureId),
          eq(studyPacks.lang, row.lang),
          eq(studyPacks.promptVersion, row.promptVersion),
        ),
      );
    return existing;
  },
  generate: async (title, segments) => {
    const model = packModel();
    return { pack: (await generateStudyPack(title, segments, model)).pack, model };
  },
  translate: (english, lang, tag) => translatePack(english, lang, undefined, tag),
};

export class MissingTranscriptError extends Error {
  constructor(lectureId: string) {
    super(`lecture ${lectureId} has no English transcript yet; run the transcript stage first`);
    this.name = "MissingTranscriptError";
  }
}

export async function ensurePack(lectureId: string, lang: Lang, deps: PackDeps = dbPackDeps): Promise<StudyPackRow> {
  const stored = await deps.getStored(lectureId, lang);
  if (stored) return stored;

  let english = await deps.getStored(lectureId, "en");
  if (!english) {
    const lecture = await deps.getLecture(lectureId);
    if (!lecture) throw new Error(`No lecture ${lectureId}`);
    const segments = await deps.getEnglishSegments(lectureId);
    if (!segments) throw new MissingTranscriptError(lectureId);
    const { pack, model } = await deps.generate(lecture.title, segments);
    english = await deps.save({ lectureId, lang: "en", promptVersion: STUDY_PROMPT_VERSION, payload: pack, model });
  }
  if (lang === "en") return english;

  const payload = await deps.translate(english.payload, lang, `lecture ${lectureId}/${lang} pack`);
  return deps.save({
    lectureId,
    lang,
    promptVersion: STUDY_PROMPT_VERSION,
    payload,
    model: translatedBy(english.model),
  });
}
