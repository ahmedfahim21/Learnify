import type { ViewPack } from "@/lib/lectures/view";

/**
 * Turn a validated study pack into OpenUI Lang programs for the study tabs:
 * one program per tab, rendered by `<Renderer library={studyLibrary} />`.
 *
 * The input is the public pack (answer keys already stripped), so nothing
 * here can leak them. Strings are written with JSON.stringify, which matches
 * OpenUI Lang's double-quoted, backslash-escaped string syntax; every
 * statement is referenced from root, so none is dropped as orphaned.
 */

const str = (s: string) => JSON.stringify(s);
const num = (n: number) => (Number.isFinite(n) ? String(Math.round(n * 100) / 100) : "0");
const strs = (xs: string[]) => `[${xs.map(str).join(", ")}]`;

export interface StudyPrograms {
  map: string;
  cards: string;
  recap: string;
}

export function serializeStudy(pack: ViewPack): StudyPrograms {
  const conceptLines = pack.concepts.map(
    (c, n) =>
      `n${n} = ConceptNode(${str(c.id)}, ${str(c.title)}, ${str(c.summary)}, ${num(c.startSec)}, ${num(c.endSec)}, ${strs(c.prereqIds)})`,
  );
  const map = [
    "root = Study([map])",
    `map = ConceptMap([${pack.concepts.map((_, n) => `n${n}`).join(", ")}])`,
    ...conceptLines,
  ].join("\n");

  const cardLines = pack.flashcards.map(
    (f, n) => `f${n} = Flashcard(${str(f.id)}, ${str(f.front)}, ${str(f.back)}, ${num(f.startSec)})`,
  );
  const cards = [
    "root = Study([deck])",
    `deck = FlashcardDeck([${pack.flashcards.map((_, n) => `f${n}`).join(", ")}])`,
    ...cardLines,
  ].join("\n");

  const pointLines = pack.recap.keyPoints.map((k, n) => `p${n} = RecapPoint(${str(k.text)}, ${num(k.startSec)})`);
  const recap = [
    "root = Study([recap])",
    `recap = Recap(${str(pack.recap.summary)}, [${pack.recap.keyPoints.map((_, n) => `p${n}`).join(", ")}])`,
    ...pointLines,
  ].join("\n");

  return { map, cards, recap };
}
