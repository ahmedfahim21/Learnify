import type { Lang } from "@/lib/languages";
import { translateSegments } from "@/lib/sarvam/translateSegments";
import type { Segment } from "@/lib/transcripts/merge";

import type { StudyPack } from "./pack";

/**
 * Translate an English study pack's text into another language.
 *
 * Only prose moves: titles, summaries, questions, options, explanations,
 * flashcards and recap points. Ids, timestamps, prerequisite links and the
 * answer index are copied from the English, so a translated pack can't grade
 * differently or point at different moments. Strings go through the same
 * hybrid path as subtitles: batched, with Mayura only for what a batch missed.
 */

export interface PackTranslator {
  (texts: string[], lang: Lang, tag?: string): Promise<string[]>;
}

export const hybridTexts: PackTranslator = async (texts, lang, tag) => {
  const pseudo: Segment[] = texts.map((text, i) => ({ i, startSec: 0, endSec: 0, text }));
  const out = await translateSegments(pseudo, lang, { translator: "hybrid", tag });
  return out.map((s) => s.text);
};

/** Every translatable string in the pack, in a fixed order, with a way to put it back. */
function slots(pack: StudyPack): { text: string; set: (p: StudyPack, t: string) => void }[] {
  const s: { text: string; set: (p: StudyPack, t: string) => void }[] = [];
  pack.concepts.forEach((c, n) => {
    s.push({ text: c.title, set: (p, t) => void (p.concepts[n].title = t) });
    s.push({ text: c.summary, set: (p, t) => void (p.concepts[n].summary = t) });
  });
  pack.checkpoints.forEach((cp, n) => {
    s.push({ text: cp.question, set: (p, t) => void (p.checkpoints[n].question = t) });
    cp.options.forEach((o, k) => s.push({ text: o, set: (p, t) => void (p.checkpoints[n].options[k] = t) }));
    s.push({ text: cp.explanation, set: (p, t) => void (p.checkpoints[n].explanation = t) });
  });
  pack.flashcards.forEach((f, n) => {
    s.push({ text: f.front, set: (p, t) => void (p.flashcards[n].front = t) });
    s.push({ text: f.back, set: (p, t) => void (p.flashcards[n].back = t) });
  });
  s.push({ text: pack.recap.summary, set: (p, t) => void (p.recap.summary = t) });
  pack.recap.keyPoints.forEach((k, n) => s.push({ text: k.text, set: (p, t) => void (p.recap.keyPoints[n].text = t) }));
  return s;
}

export async function translatePack(
  english: StudyPack,
  lang: Lang,
  translateTexts: PackTranslator = hybridTexts,
  tag?: string,
): Promise<StudyPack> {
  const all = slots(english);
  const translated = await translateTexts(
    all.map((x) => x.text),
    lang,
    tag,
  );
  if (translated.length !== all.length) {
    throw new Error(`pack translation returned ${translated.length} strings for ${all.length}`);
  }
  const out = structuredClone(english);
  all.forEach((slot, n) => slot.set(out, translated[n]));
  return out;
}
