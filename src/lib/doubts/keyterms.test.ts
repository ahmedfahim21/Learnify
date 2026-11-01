import { describe, expect, it } from "vitest";

import { lectureKeyTerms, type AnswerDeps } from "./answer";
import { cleanTitle, keyTerms, MAX_KEYTERMS } from "./keyterms";

const seg = (startSec: number, text: string, i = 0) => ({ i, startSec, endSec: startSec + 10, text });

describe("cleanTitle", () => {
  it.each([
    ["Coloumb's Law", "Coloumb's Law"],
    ["Lecture 18 : Transient over voltages and Insulation coordination (Contd.)", "Transient over voltages and Insulation coordination"],
    ["Using Rolle's theorem and Mean value theorem - Part 1", "Using Rolle's theorem and Mean value theorem"],
    ["Black Body Radiation VI", "Black Body Radiation"],
    ["NOC:Basic Calculus _ 1", "Basic Calculus _ 1"],
  ])("%s → %s", (title, cleaned) => {
    expect(cleanTitle(title)).toBe(cleaned);
  });
});

describe("keyTerms", () => {
  const english = [
    seg(100, "Far earlier: thermodynamics thermodynamics thermodynamics."),
    seg(500, "Coulomb's law says the force depends on permittivity.", 1),
    seg(560, "The permittivity of free space appears because of SI units. Actually, Coulomb measured it.", 2),
    seg(700, "Later: superposition.", 3),
  ];

  it("gives single words: the concepts' first, then the lecturer's near the moment, most used first", () => {
    expect(keyTerms({ lectureTitle: "Lecture 3 : Coloumb's Law", concepts: ["Coulomb's Law for Two Point Charges", "Permittivity of free space"], english, atSec: 600 })).toEqual([
      "Coulomb",
      "Point",
      "Charges",
      "Permittivity",
      "space",
      "appears",
      "depends",
      "measured",
    ]);
  });

  it("uses the title's words only before there are concepts, and skips far, short and common words", () => {
    const terms = keyTerms({ lectureTitle: "Lecture 3 : Coloumb's Law (Contd.)", concepts: [], english, atSec: 600 });
    expect(terms).toEqual(["Coloumb", "coulomb", "permittivity", "appears", "depends", "measured"]);
    for (const w of ["thermodynamics", "superposition", "actually", "Lecture", "Contd"]) expect(terms).not.toContain(w);
  });

  it("works without a transcript, and keeps to Saaras's 50 terms", () => {
    expect(keyTerms({ lectureTitle: "Coloumb's Law", concepts: [], english: null, atSec: 0 })).toEqual(["Coloumb"]);
    const many = Array.from({ length: 80 }, (_, i) => `Concept${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`);
    expect(keyTerms({ lectureTitle: "T", concepts: many, english: null, atSec: 0 })).toHaveLength(MAX_KEYTERMS);
  });
});

describe("lectureKeyTerms", () => {
  const deps = (title: string | null) =>
    ({
      lectureTitle: async () => title,
      englishSegments: async () => [seg(590, "Gaussian surfaces enclose charge.")],
      concepts: async (_id, lang) => (lang === "en" ? [{ title: "Gauss's law", startSec: 0 }] : [{ title: "गॉस का नियम", startSec: 0 }]),
    }) as Partial<AnswerDeps> as AnswerDeps;

  it("uses the English pack's concepts and the transcript at the moment", async () => {
    expect(await lectureKeyTerms("l", 600, deps("Gauss's Law (Contd.)"))).toEqual(["Gauss", "enclose", "gaussian", "surfaces"]);
  });

  it("is null for an unknown lecture", async () => {
    expect(await lectureKeyTerms("l", 600, deps(null))).toBeNull();
  });
});
