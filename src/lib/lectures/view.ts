import { type Lang, isLang } from "@/lib/languages";
import { lectureStatus, type LectureStatus } from "@/lib/jobs/prepare";
import { type PublicPack, publicPack } from "@/lib/study/grading";
import { dbPackDeps } from "@/lib/study/store";
import type { Segment } from "@/lib/transcripts/merge";
import { dbDeps as transcriptDeps } from "@/lib/transcripts/store";

/**
 * What the lecture player reads: the lecture, its subtitles in English and
 * the chosen language, the study pack without answer keys, and how far
 * preparation has got. Shared by GET /api/lectures/[id] and the prepare route.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate route input before it reaches Postgres (a malformed uuid is a 500 there, not a 400). */
export function parseLectureRequest(lectureId: string, langParam: string | null): { lectureId: string; lang: Lang } | Response {
  if (!UUID.test(lectureId)) return Response.json({ error: "Lecture id must be a uuid." }, { status: 400 });
  const lang = langParam ?? "en";
  if (!isLang(lang)) return Response.json({ error: `Unsupported language "${lang}".` }, { status: 400 });
  return { lectureId, lang };
}

export interface TrackDto {
  lang: Lang;
  source: "nptel" | "youtube" | "sarvam";
  durationSec: number;
  segments: Segment[];
}

export interface LectureView {
  lecture: {
    id: string;
    courseId: number;
    position: number;
    unitName: string;
    title: string;
    youtubeId: string | null;
  };
  status: LectureStatus;
  subtitles: { en: TrackDto | null; target: TrackDto | null };
  pack: PublicPack | null;
}

export async function getLectureView(lectureId: string, lang: Lang): Promise<LectureView | null> {
  const lecture = await transcriptDeps.getLecture(lectureId);
  if (!lecture) return null;

  const [status, en, target, packRow] = await Promise.all([
    lectureStatus(lectureId, lang),
    transcriptDeps.getStored(lectureId, "en"),
    lang === "en" ? null : transcriptDeps.getStored(lectureId, lang),
    dbPackDeps.getStored(lectureId, lang),
  ]);
  const track = (t: typeof en): TrackDto | null =>
    t ? { lang: t.lang as Lang, source: t.source, durationSec: t.durationSec, segments: t.segments } : null;

  return {
    lecture: {
      id: lecture.id,
      courseId: lecture.courseId,
      position: lecture.position,
      unitName: lecture.unitName,
      title: lecture.title,
      youtubeId: lecture.youtubeId,
    },
    status,
    subtitles: { en: track(en), target: lang === "en" ? track(en) : track(target) },
    pack: packRow ? publicPack(packRow.payload) : null,
  };
}
