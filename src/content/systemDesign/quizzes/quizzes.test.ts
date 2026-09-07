import { describe, expect, it } from "vitest";

import { PROBLEMS } from "../index";
import { DESIGN_PHASES } from "../types";
import { QUIZ_BANK, getQuiz } from "./index";

/**
 * The pre-generated quiz is the practice path that always works — signed out,
 * or once the generative budget is spent — so a course missing one, or a
 * question whose "correct" option doesn't exist, is a silent hole in the
 * product rather than a cosmetic issue.
 */
describe("quiz banks", () => {
  it("covers every course in the catalog", () => {
    for (const problem of PROBLEMS) {
      expect(getQuiz(problem.slug).length, `${problem.slug} has no quiz`).toBeGreaterThan(0);
    }
  });

  it("has no quiz for a course that doesn't exist", () => {
    const slugs = new Set(PROBLEMS.map((p) => p.slug));
    for (const slug of Object.keys(QUIZ_BANK)) {
      expect(slugs.has(slug), `quiz bank has unknown course "${slug}"`).toBe(true);
    }
  });

  it("returns an empty bank rather than throwing for an unknown slug", () => {
    expect(getQuiz("not-a-course")).toEqual([]);
  });

  for (const problem of PROBLEMS) {
    describe(problem.slug, () => {
      const questions = getQuiz(problem.slug);

      it("gives every question a unique id", () => {
        const ids = questions.map((q) => q.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it("marks a correct option that actually exists", () => {
        for (const q of questions) {
          const ids = q.options.map((o) => o.id);
          expect(new Set(ids).size, `${q.id}: duplicate option ids`).toBe(ids.length);
          expect(ids, `${q.id}: correctOptionId matches no option`).toContain(q.correctOptionId);
        }
      });

      it("offers a real choice on every question", () => {
        for (const q of questions) {
          expect(q.options.length, `${q.id}: needs at least three options`).toBeGreaterThanOrEqual(3);
        }
      });

      it("explains every question, whichever way it was answered", () => {
        for (const q of questions) {
          expect(q.explanation.trim(), `${q.id}: no explanation`).toBeTruthy();
          expect(q.question.trim(), `${q.id}: no question text`).toBeTruthy();
        }
      });

      it("tags each question with a real design phase the course teaches", () => {
        const taught = new Set(problem.chapters.map((c) => c.phase));
        for (const q of questions) {
          expect(DESIGN_PHASES as readonly string[], `${q.id}: unknown phase`).toContain(q.phase);
          expect(taught.has(q.phase), `${q.id}: phase "${q.phase}" isn't a chapter of this course`).toBe(true);
        }
      });

      it("draws on more than one chapter", () => {
        // A quiz that only probes one stage isn't testing the course.
        expect(new Set(questions.map((q) => q.phase)).size).toBeGreaterThan(1);
      });
    });
  }
});
