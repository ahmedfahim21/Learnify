import { segmentsBetween, type Segment } from "@/lib/transcripts/merge";

import { DOUBT_WINDOW_AFTER_SEC, DOUBT_WINDOW_BEFORE_SEC } from "./prompt";

/**
 * Words Saaras should expect in a spoken doubt, so "Coulomb" isn't heard as
 * "column". Students say the lecture's technical terms in English, so the terms
 * come from the English side: words in the study pack's concept titles (or,
 * before there is a pack, NPTEL's lecture title, which is sometimes misspelt),
 * then words the lecturer said just before the pause.
 *
 * Single words, not phrases: given "Coulomb's Law for Two Point Charges",
 * Saaras pasted the whole title in for "Coulomb force". Saaras takes at most
 * 50 terms; they bias, never force.
 */
export const MAX_KEYTERMS = 50;
const MIN_TERM_LENGTH = 5;
const MIN_SPOKEN_LENGTH = 7;
const MAX_SPOKEN_TERMS = 20;

/** Long words lecturers and titles use that aren't the subject. */
const COMMON = new Set(
  "about actually after again basically because before between certain consider different equally everything example exactly following general however important instead lecture nothing obviously other particular probably problem question really remember something suppose their there these thing things those through together using where whatever whether which without would written".split(" "),
);

/** NPTEL titles carry numbering and continuation marks that aren't terms. */
export function cleanTitle(title: string): string {
  return title
    .replace(/^NOC:\s*/i, "")
    .replace(/^(lecture|lec|module|week)\s*[\d.]+\s*[:.\-–]?\s*/i, "")
    .replace(/\(\s*contd\.?\s*\)|\bpart\s*[-–]?\s*\d+\b|\b[IVX]+$/gi, "")
    .replace(/\s*[-–:]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function words(text: string, minLength: number): string[] {
  return (text.match(/[A-Za-z][A-Za-z'-]*[A-Za-z]/g) ?? [])
    .map((w) => w.replace(/'s$/i, ""))
    .filter((w) => w.length >= minLength && !COMMON.has(w.toLowerCase()));
}

export function keyTerms(input: { lectureTitle: string; concepts: string[]; english: Segment[] | null; atSec: number }): string[] {
  const spoken = new Map<string, number>();
  const window = input.english ? segmentsBetween(input.english, Math.max(0, input.atSec - DOUBT_WINDOW_BEFORE_SEC), input.atSec + DOUBT_WINDOW_AFTER_SEC) : [];
  for (const s of window) {
    for (const w of words(s.text, MIN_SPOKEN_LENGTH)) spoken.set(w.toLowerCase(), (spoken.get(w.toLowerCase()) ?? 0) + 1);
  }
  const byUse = [...spoken.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([w]) => w);

  const named = input.concepts.length > 0 ? input.concepts.flatMap((c) => words(c, MIN_TERM_LENGTH)) : words(cleanTitle(input.lectureTitle), MIN_TERM_LENGTH);
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const term of [...named, ...byUse.slice(0, MAX_SPOKEN_TERMS)]) {
    if (seen.has(term.toLowerCase())) continue;
    seen.add(term.toLowerCase());
    terms.push(term);
    if (terms.length === MAX_KEYTERMS) break;
  }
  return terms;
}
