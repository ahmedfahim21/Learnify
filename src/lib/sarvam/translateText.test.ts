import { describe, expect, it, vi } from "vitest";

import { hasWords, maskMath, translateProgram, translateTexts, unmaskMath } from "./translateText";

/** A translator that tags text and keeps placeholders, like Sarvam-Translate does. */
const fake = vi.fn(async (text: string) => `«${text}»`);

describe("maskMath", () => {
  it("masks inline, display and \\( \\) maths and puts it back exactly", () => {
    const text = "Force $F = k\\frac{q_1 q_2}{r^2}$ and $$E = mc^2$$ and \\(x\\)";
    const { masked, maths } = maskMath(text);
    expect(masked).toBe("Force ⟦0⟧ and ⟦1⟧ and ⟦2⟧");
    expect(maths).toEqual(["$F = k\\frac{q_1 q_2}{r^2}$", "$$E = mc^2$$", "\\(x\\)"]);
    expect(unmaskMath(masked, maths)).toBe(text);
  });

  it("finds words only outside the maths", () => {
    expect(hasWords("$r_{12}^2$")).toBe(false);
    expect(hasWords("42")).toBe(false);
    expect(hasWords("Force is $F$")).toBe(true);
  });
});

describe("translateTexts", () => {
  it("translates each distinct string once and keeps the order", async () => {
    fake.mockClear();
    const out = await translateTexts(["Good", "$x$", "Good", "Bad"], "ne", fake);
    expect(out).toEqual(["«Good»", "$x$", "«Good»", "«Bad»"]);
    expect(fake).toHaveBeenCalledTimes(2);
  });

  it("puts the maths back after translating around it", async () => {
    const out = await translateTexts(["Force is $F = ma$ always"], "ne", async (t) => t.replace("Force is", "बल हो").replace("always", "सधैं"));
    expect(out).toEqual(["बल हो $F = ma$ सधैं"]);
  });

  it("fails loudly when a translation drops a formula", async () => {
    await expect(translateTexts(["Force is $F = ma$"], "ne", async () => "बल हो")).rejects.toThrow(/dropped maths/);
  });
});

describe("translateProgram", () => {
  const program = [
    'root = Screen("Practice", [quiz])',
    'quiz = Quiz("Coulomb\'s law", [q1, f1, t1])',
    'q1 = Mcq("What is $F$ proportional to?", ["$q_1 q_2$", "the \\"distance\\""], 0, "From the lecture.", 135)',
    'f1 = Formula("$F = k\\frac{q_1 q_2}{r^2}$", "Coulomb\'s law")',
    "t1 = TrueFalse(\"Like charges repel.\", true, \"They push apart.\", 222)",
  ].join("\n");

  it("translates only student-facing text and leaves structure, numbers and maths alone", async () => {
    const out = await translateProgram(program, "ne", fake);
    expect(out.split("\n")).toEqual([
      'root = Screen("«Practice»", [quiz])',
      'quiz = Quiz("«Coulomb\'s law»", [q1, f1, t1])',
      'q1 = Mcq("«What is ⟦0⟧ proportional to?»", ["$q_1 q_2$", "«the \\"distance\\"»"], 0, "«From the lecture.»", 135)'.replace("⟦0⟧", "$F$"),
      'f1 = Formula("$F = k\\frac{q_1 q_2}{r^2}$", "«Coulomb\'s law»")',
      't1 = TrueFalse("«Like charges repel.»", true, "«They push apart.»", 222)',
    ]);
  });

  it("escapes quotes and newlines the translation introduces", async () => {
    const out = await translateProgram('k = KeyIdea("Hello")', "ne", async () => 'a "quoted"\nline');
    expect(out).toBe('k = KeyIdea("a \\"quoted\\"\\nline")');
  });

  it("returns a program with nothing to translate unchanged, without calling Sarvam", async () => {
    const translator = vi.fn(fake);
    expect(await translateProgram('root = Screen("", [x])', "ne", translator)).toBe('root = Screen("", [x])');
    expect(translator).not.toHaveBeenCalled();
  });
});
