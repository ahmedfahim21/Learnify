import { describe, expect, it, vi } from "vitest";

import { checkScreen } from "./generate";
import { QUIZ_EXAMPLE } from "./prompt";
import { applyFix, applyVerdicts, describe as describeQuestion, excerpt, quizQuestions, type Verdict, verifyMessages, verifyQuiz } from "./verifyKeys";

const ok = (id: string): Verdict => ({ id, verdict: "correct", answerIndex: null, answer: null, fillAnswer: null, order: null, matches: null, explanation: null });
const fix = (id: string, f: Partial<Verdict>): Verdict => ({ ...ok(id), verdict: "fixed", ...f });

describe("quizQuestions", () => {
  it("finds every question with its statement id and props", () => {
    const qs = quizQuestions(QUIZ_EXAMPLE);
    expect(qs.map((q) => [q.id, q.type])).toEqual([
      ["q1", "Mcq"],
      ["q2", "TrueFalse"],
      ["q3", "FillBlank"],
      ["q4", "MatchPairs"],
      ["q5", "OrderSteps"],
    ]);
    expect(qs[0].props).toMatchObject({ question: "Which of these is irrational?", answerIndex: 2, sec: 300 });
  });

  it("shows the checker each question with its claimed answer", () => {
    const [q1, q2] = quizQuestions(QUIZ_EXAMPLE);
    expect(describeQuestion(q1)).toBe("[q1] Multiple choice: Which of these is irrational?\nOptions:\n  0. 1/3\n  1. 0.25\n  2. √2\n  3. -4\nClaimed answer: option 2");
    expect(describeQuestion(q2)).toBe("[q2] True or false: Every integer is a rational number.\nClaimed answer: true");
  });

  it("puts the relevant transcript before the questions", () => {
    const [, user] = verifyMessages(quizQuestions(QUIZ_EXAMPLE), "Transcript:\n[60s] hello\n[900s] far away");
    expect(user.content.startsWith("Lecture transcript, the parts these questions are about:\n[60s] hello\n\nQuestions:\n\n[q1] Multiple choice")).toBe(true);
    expect(user.content).not.toContain("far away");
  });
});

describe("excerpt", () => {
  const transcript = ["Transcript:", "[0s] a", "[100s] b", "[300s] c", "[500s] d", "[700s] e", "", "Write the screen in English."].join("\n");

  it("keeps only lines within two minutes of a question's moment, marking gaps", () => {
    expect(excerpt(transcript, [100])).toBe("[0s] a\n[100s] b");
    expect(excerpt(transcript, [100, 600])).toBe("[0s] a\n[100s] b\n…\n[500s] d\n[700s] e");
  });

  it("passes a transcript without timestamps, or questions without moments, through whole", () => {
    expect(excerpt("just text", [100])).toBe("just text");
    expect(excerpt(transcript, [])).toBe(transcript);
  });
});

describe("applyFix", () => {
  const [q1, q2, q3, q4, q5] = quizQuestions(QUIZ_EXAMPLE);

  it("moves an Mcq's key and replaces its explanation, nothing else", () => {
    expect(applyFix(q1, fix("q1", { answerIndex: 0, explanation: "Because." }))).toEqual({ ...q1.props, answerIndex: 0, explanation: "Because." });
  });

  it("flips a true/false, and refills a blank without the old alternatives", () => {
    expect(applyFix(q2, fix("q2", { answer: false }))).toEqual({ ...q2.props, answer: false });
    expect(applyFix(q3, fix("q3", { fillAnswer: " recurs " }))).toEqual({ ...q3.props, answer: "recurs", alternatives: [] });
  });

  it("reorders steps and right-hand matches by the given indexes", () => {
    expect(applyFix(q5, fix("q5", { order: [1, 0, 2, 3] }))?.steps).toEqual(["Z", "N", "Q", "R"]);
    expect(applyFix(q4, fix("q4", { matches: [2, 0, 1] }))?.right).toEqual(["Q", "N", "Z"]);
  });

  it("refuses a fix that doesn't fit the question", () => {
    expect(applyFix(q1, fix("q1", { answerIndex: 9 }))).toBeNull();
    expect(applyFix(q1, fix("q1", {}))).toBeNull();
    expect(applyFix(q5, fix("q5", { order: [0, 0, 1, 2] }))).toBeNull();
    expect(applyFix(q4, fix("q4", { matches: [0, 1] }))).toBeNull();
    expect(applyFix(q3, fix("q3", { fillAnswer: "  " }))).toBeNull();
  });
});

describe("applyVerdicts", () => {
  const qs = quizQuestions(QUIZ_EXAMPLE);

  it("rewrites fixed questions in place and leaves correct ones byte for byte", () => {
    const { program, report } = applyVerdicts(QUIZ_EXAMPLE, qs, [fix("q1", { answerIndex: 0, explanation: "1/3 is wrong too" }), ok("q2"), ok("q3"), ok("q4"), ok("q5")]);
    const before = QUIZ_EXAMPLE.split("\n");
    const after = program.split("\n");
    expect(after[2]).toBe('q1 = Mcq("Which of these is irrational?", ["1/3","0.25","√2","-4"], 0, "1/3 is wrong too", 300)');
    expect(after.filter((l, i) => l !== before[i])).toEqual([after[2]]);
    expect(report).toEqual({ checked: 5, fixed: ["q1"], dropped: [] });
    expect(checkScreen(program, "quiz")).toMatchObject({ ok: true });
  });

  it("drops unsure questions, unfixable fixes and missing verdicts from the quiz and the program", () => {
    const { program, report } = applyVerdicts(QUIZ_EXAMPLE, qs, [
      ok("q1"),
      { ...ok("q2"), verdict: "unsure" },
      fix("q3", {}),
      ok("q4"),
    ]);
    expect(report).toEqual({ checked: 5, fixed: [], dropped: ["q2", "q3", "q5"] });
    expect(program.split("\n")[1]).toBe('quiz = Quiz("Rational numbers", [q1, q4])');
    expect(program).not.toMatch(/^q[235] = /m);
  });
});

describe("verifyQuiz", () => {
  it("sends the questions with the transcript and applies what comes back", async () => {
    const call = vi.fn(async () => [ok("q1"), ok("q2"), ok("q3"), ok("q4"), fix("q5", { order: [0, 1, 2, 3] })]);
    const { report } = await verifyQuiz(QUIZ_EXAMPLE, "Transcript:\n[1s] x", call, "t");
    expect(call).toHaveBeenCalledWith(expect.any(Array), "t");
    expect(report).toEqual({ checked: 5, fixed: ["q5"], dropped: [] });
  });

  it("doesn't call the checker for a screen without questions", async () => {
    const call = vi.fn();
    expect(await verifyQuiz('root = Screen("x", [])', "t", call)).toEqual({ program: 'root = Screen("x", [])', report: { checked: 0, fixed: [], dropped: [] } });
    expect(call).not.toHaveBeenCalled();
  });
});
