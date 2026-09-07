import { describe, expect, it } from "vitest";

import { PROBLEM_SLUGS } from "@/content/systemDesign";
import { toEnvelope, validatePresentUi } from "@/lib/a2ui/emit";

import { collectComponents, gradeAction } from "./grading";
import {
  STARTER_COMPONENT_ID,
  STARTER_TOOL_RESULT,
  STARTER_TOOL_USE_ID,
  starterPresentUi,
  starterQuestion,
} from "./starter";
import { PRESENT_UI_TOOL_NAME } from "./tools";
import { EventKind, type StoredEvent } from "./transcript";

/** The transcript the turn route seeds before the model's first call. */
function seededTranscript(problemSlug: string): StoredEvent[] {
  const starter = starterPresentUi(problemSlug);
  if (!starter) throw new Error(`no starter for ${problemSlug}`);
  return [
    { seq: 1, role: "user", payload: { kind: EventKind.UserMessage, text: "snapshot" } },
    {
      seq: 2,
      role: "tutor",
      payload: {
        kind: EventKind.TutorToolUse,
        id: STARTER_TOOL_USE_ID,
        name: PRESENT_UI_TOOL_NAME,
        input: starter,
      },
    },
    {
      seq: 3,
      role: "user",
      payload: {
        kind: EventKind.ToolResult,
        toolUseId: STARTER_TOOL_USE_ID,
        content: STARTER_TOOL_RESULT,
      },
    },
  ];
}

describe("session starter", () => {
  it("has one for every authored concept", () => {
    const missing = PROBLEM_SLUGS.filter((slug) => starterPresentUi(slug) === null);
    expect(missing).toEqual([]);
  });

  it.each(PROBLEM_SLUGS)("renders through the real validator: %s", (slug) => {
    const starter = starterPresentUi(slug);
    if (!starter) throw new Error("no starter");
    // The same call the renderer path makes — a starter that would not survive
    // validation is a starter the model could not have sent either.
    const envelope = toEnvelope(validatePresentUi(starter, "session:test"));
    expect(envelope.surfaceId).toBe("session:test");
  });

  it.each(PROBLEM_SLUGS)("is gradeable from the seeded transcript: %s", (slug) => {
    const question = starterQuestion(slug);
    if (!question) throw new Error("no starter question");
    const components = collectComponents(seededTranscript(slug));

    const right = gradeAction(
      {
        componentId: STARTER_COMPONENT_ID,
        name: "select",
        payload: { optionId: question.correctOptionId },
      },
      components,
    );
    expect(right.verdict).toBe("correct");

    const wrongOption = question.options.find((o) => o.id !== question.correctOptionId);
    if (!wrongOption) throw new Error("starter has only one option");
    const wrong = gradeAction(
      { componentId: STARTER_COMPONENT_ID, name: "select", payload: { optionId: wrongOption.id } },
      components,
    );
    expect(wrong.verdict).toBe("incorrect");
    // The verdict has to name the right answer, since that message is the only
    // thing the model learns about the exchange.
    expect(wrong.message).toContain(
      question.options.find((o) => o.id === question.correctOptionId)?.label ?? "",
    );
  });

  it("prefers a requirements-phase question, where a diagnostic belongs", () => {
    const withRequirements = PROBLEM_SLUGS.filter(
      (slug) => starterQuestion(slug)?.phase === "requirements",
    );
    expect(withRequirements.length).toBeGreaterThan(0);
  });
});
