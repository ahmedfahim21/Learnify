import { describe, expect, it } from "vitest";

import { GRADED_WIDGETS } from "./catalog";
import { A2UIValidationError, validatePresentUi } from "./emit";

const SURFACE = "session:test";

function check(id: string, component: (typeof GRADED_WIDGETS)[number]) {
  if (component === "OrderingExercise") {
    return {
      id,
      component,
      properties: {
        prompt: "Order these",
        items: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
        correctOrder: ["a", "b"],
      },
    };
  }
  if (component === "MatchingPairs") {
    return {
      id,
      component,
      properties: {
        prompt: "Match these",
        left: [{ id: "l", label: "L" }],
        right: [{ id: "r", label: "R" }],
        correctPairs: [{ leftId: "l", rightId: "r" }],
      },
    };
  }
  return {
    id,
    component,
    properties: {
      prompt: "Which one?",
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      correctOptionId: "a",
    },
  };
}

const column = (children: string[]) => ({
  id: "root",
  component: "Column",
  properties: {},
  children,
});

describe("validatePresentUi — one graded check per screen", () => {
  it.each(GRADED_WIDGETS)("allows a single %s", (component) => {
    const result = validatePresentUi(
      { root: "root", components: [column(["c1"]), check("c1", component)] },
      SURFACE,
    );
    expect(result.components).toHaveLength(2);
  });

  it.each(GRADED_WIDGETS)("rejects two of the same kind (%s)", (component) => {
    expect(() =>
      validatePresentUi(
        {
          root: "root",
          components: [column(["c1", "c2"]), check("c1", component), check("c2", component)],
        },
        SURFACE,
      ),
    ).toThrow(A2UIValidationError);
  });

  it("rejects two graded checks of different kinds", () => {
    expect(() =>
      validatePresentUi(
        {
          root: "root",
          components: [
            column(["c1", "c2"]),
            check("c1", "MultipleChoiceCheck"),
            check("c2", "MatchingPairs"),
          ],
        },
        SURFACE,
      ),
    ).toThrow(/at most one graded check/i);
  });

  it("names the offending ids, so the repair turn knows which to drop", () => {
    try {
      validatePresentUi(
        {
          root: "root",
          components: [
            column(["first", "second"]),
            check("first", "MultipleChoiceCheck"),
            check("second", "MultipleChoiceCheck"),
          ],
        },
        SURFACE,
      );
      throw new Error("expected a validation error");
    } catch (err) {
      expect(err).toBeInstanceOf(A2UIValidationError);
      expect((err as Error).message).toContain('"first"');
      expect((err as Error).message).toContain('"second"');
    }
  });

  it("still allows several ungraded widgets alongside the one check", () => {
    const result = validatePresentUi(
      {
        root: "root",
        components: [
          column(["n1", "e1", "c1"]),
          { id: "n1", component: "Narration", properties: { text: "Here is the idea." } },
          {
            id: "e1",
            component: "ExplanationCard",
            properties: { title: "Caching", body: "Keep the hot set close." },
          },
          check("c1", "MultipleChoiceCheck"),
        ],
      },
      SURFACE,
    );
    expect(result.components).toHaveLength(4);
  });
});
