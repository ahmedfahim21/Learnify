import { describe, expect, it } from "vitest";

import { collectComponents, GRADED_WIDGETS, gradeAction, type LearnerAction } from "./grading";
import { EventKind, type StoredEvent } from "./transcript";
import { PRESENT_UI_TOOL_NAME } from "./tools";
import type { ComponentDef } from "../a2ui/messages";
import { WIDGET_NAMES } from "../a2ui/catalog";

function mcq(overrides: Partial<ComponentDef["properties"]> = {}): ComponentDef {
  return {
    id: "mc1",
    component: "MultipleChoiceCheck",
    properties: {
      prompt: "Which store fits a write-heavy append-only log?",
      options: [
        { id: "a", label: "Relational database" },
        { id: "b", label: "Log-structured store" },
      ],
      correctOptionId: "b",
      ...overrides,
    },
  };
}

function index(...defs: ComponentDef[]): Record<string, ComponentDef> {
  return Object.fromEntries(defs.map((d) => [d.id, d]));
}

function action(overrides: Partial<LearnerAction> = {}): LearnerAction {
  return { componentId: "mc1", name: "select", ...overrides };
}

describe("collectComponents", () => {
  const toolUse = (seq: number, components: ComponentDef[]): StoredEvent => ({
    seq,
    payload: {
      kind: EventKind.TutorToolUse,
      name: PRESENT_UI_TOOL_NAME,
      input: { root: components[0].id, components },
    },
  } as unknown as StoredEvent);

  it("indexes every presented component by id", () => {
    const a: ComponentDef = { id: "a", component: "Narration", properties: { text: "one" } };
    const b: ComponentDef = { id: "b", component: "Narration", properties: { text: "two" } };
    expect(Object.keys(collectComponents([toolUse(1, [a]), toolUse(2, [b])])).sort()).toEqual([
      "a",
      "b",
    ]);
  });

  it("applies last write wins in seq order, not array order", () => {
    const first: ComponentDef = { id: "a", component: "Narration", properties: { text: "first" } };
    const second: ComponentDef = { id: "a", component: "Narration", properties: { text: "second" } };
    // Deliberately out of order: collectComponents must sort by seq itself.
    const collected = collectComponents([toolUse(2, [second]), toolUse(1, [first])]);
    expect(collected.a.properties.text).toBe("second");
  });

  it("ignores events that aren't present_ui tool uses", () => {
    const other = {
      seq: 1,
      payload: { kind: EventKind.TutorToolUse, name: "update_plan", input: { phase: "teach" } },
    } as unknown as StoredEvent;
    expect(collectComponents([other])).toEqual({});
  });
});

describe("gradeAction — MultipleChoiceCheck", () => {
  it("grades a correct choice and routes mastery evidence", () => {
    const result = gradeAction(
      action({ payload: { optionId: "b" } }),
      index(mcq({ conceptSlug: "storage-engines" })),
    );
    expect(result.verdict).toBe("correct");
    expect(result.message).toContain("Server grading: CORRECT");
    expect(result.message).toContain("Log-structured store");
    expect(result.mastery).toEqual({
      conceptSlug: "storage-engines",
      kind: "mcq",
      quality: 5,
    });
  });

  it("grades a wrong choice and names the correct answer", () => {
    const result = gradeAction(
      action({ payload: { optionId: "a" } }),
      index(mcq({ conceptSlug: "storage-engines" })),
    );
    expect(result.verdict).toBe("incorrect");
    expect(result.message).toContain("Server grading: INCORRECT");
    expect(result.message).toContain("Log-structured store");
    expect(result.mastery).toEqual({
      conceptSlug: "storage-engines",
      kind: "mcq",
      quality: 1,
    });
  });

  it("omits mastery when the widget carries no conceptSlug", () => {
    const result = gradeAction(action({ payload: { optionId: "b" } }), index(mcq()));
    expect(result.verdict).toBe("correct");
    expect(result.mastery).toBeUndefined();
  });

  it("ignores a blank conceptSlug", () => {
    const result = gradeAction(
      action({ payload: { optionId: "b" } }),
      index(mcq({ conceptSlug: "   " })),
    );
    expect(result.mastery).toBeUndefined();
  });

  it("falls through to ungraded with no answer key", () => {
    const result = gradeAction(
      action({ payload: { optionId: "b" } }),
      index(mcq({ correctOptionId: undefined })),
    );
    expect(result.verdict).toBe("ungraded");
  });
});

describe("gradeAction — OrderingExercise", () => {
  const ordering: ComponentDef = {
    id: "ord1",
    component: "OrderingExercise",
    properties: {
      prompt: "Order the write path.",
      items: [
        { id: "1", label: "Client" },
        { id: "2", label: "Load balancer" },
        { id: "3", label: "Database" },
      ],
      correctOrder: ["1", "2", "3"],
      conceptSlug: "write-path",
    },
  };
  const submit = (orderedIds: string[]): LearnerAction => ({
    componentId: "ord1",
    name: "submit_order",
    payload: { orderedIds, label: orderedIds.join(", ") },
  });

  it("grades an exact sequence match as correct", () => {
    const result = gradeAction(submit(["1", "2", "3"]), index(ordering));
    expect(result.verdict).toBe("correct");
    expect(result.mastery).toEqual({ conceptSlug: "write-path", kind: "ordering", quality: 5 });
  });

  it("is order-sensitive", () => {
    const result = gradeAction(submit(["1", "3", "2"]), index(ordering));
    expect(result.verdict).toBe("incorrect");
    expect(result.message).toContain("Client → Load balancer → Database");
    expect(result.mastery?.quality).toBe(1);
  });

  it("marks a short submission incorrect rather than matching a prefix", () => {
    expect(gradeAction(submit(["1", "2"]), index(ordering)).verdict).toBe("incorrect");
  });

  it("defers to the tutor when no answer key was supplied", () => {
    const noKey: ComponentDef = {
      ...ordering,
      properties: { ...ordering.properties, correctOrder: [] },
    };
    expect(gradeAction(submit(["1", "2", "3"]), index(noKey)).verdict).toBe("ungraded");
  });
});

describe("gradeAction — MatchingPairs", () => {
  const matching: ComponentDef = {
    id: "mp1",
    component: "MatchingPairs",
    properties: {
      left: [
        { id: "l1", label: "Cache" },
        { id: "l2", label: "Queue" },
      ],
      right: [
        { id: "r1", label: "Absorbs read load" },
        { id: "r2", label: "Absorbs write bursts" },
      ],
      correctPairs: [
        { leftId: "l1", rightId: "r1" },
        { leftId: "l2", rightId: "r2" },
      ],
      conceptSlug: "components",
    },
  };
  const submit = (pairs: { leftId: string; rightId: string }[]): LearnerAction => ({
    componentId: "mp1",
    name: "submit_pairs",
    payload: { pairs, label: "matches" },
  });

  it("grades matches independently of submission order", () => {
    const result = gradeAction(
      submit([
        { leftId: "l2", rightId: "r2" },
        { leftId: "l1", rightId: "r1" },
      ]),
      index(matching),
    );
    expect(result.verdict).toBe("correct");
    expect(result.mastery).toEqual({ conceptSlug: "components", kind: "matching", quality: 5 });
  });

  it("grades a swapped pairing as incorrect and lists the right matches", () => {
    const result = gradeAction(
      submit([
        { leftId: "l1", rightId: "r2" },
        { leftId: "l2", rightId: "r1" },
      ]),
      index(matching),
    );
    expect(result.verdict).toBe("incorrect");
    expect(result.message).toContain("Cache → Absorbs read load");
    expect(result.message).toContain("Queue → Absorbs write bursts");
  });

  it("marks a partial submission incorrect", () => {
    expect(gradeAction(submit([{ leftId: "l1", rightId: "r1" }]), index(matching)).verdict).toBe(
      "incorrect",
    );
  });
});

describe("gradeAction — fuzzy and unknown interactions", () => {
  it("passes a diagram node click through ungraded", () => {
    const diagram: ComponentDef = {
      id: "d1",
      component: "Diagram",
      properties: { source: "graph TD; A-->B" },
    };
    const result = gradeAction(
      { componentId: "d1", name: "node_click", payload: { nodeId: "A", label: 'Clicked node "A"' } },
      index(diagram),
    );
    expect(result.verdict).toBe("ungraded");
    expect(result.message).toBe('Clicked node "A"');
    expect(result.mastery).toBeUndefined();
  });

  it("passes a free response through ungraded", () => {
    const free: ComponentDef = {
      id: "fr1",
      component: "FreeResponse",
      properties: { prompt: "Explain write amplification." },
    };
    const result = gradeAction(
      { componentId: "fr1", name: "submit", payload: { label: "It writes more than you asked." } },
      index(free),
    );
    expect(result.verdict).toBe("ungraded");
  });

  it("survives an action for a component it has never seen", () => {
    const result = gradeAction({ componentId: "ghost", name: "select" }, {});
    expect(result.verdict).toBe("ungraded");
    expect(result.message).toBe("(the learner interacted)");
  });
});

describe("GRADED_WIDGETS", () => {
  // The list is a claim about gradeAction's switch, and the landing page reads
  // it. Drive both directions off the real function so neither can drift.
  const ungraded = WIDGET_NAMES.filter((n) => !(GRADED_WIDGETS as readonly string[]).includes(n));

  it.each(GRADED_WIDGETS)("%s is graded by the server", (name) => {
    // A payload that cannot match any answer key, so a widget that is really
    // graded must return "incorrect" rather than falling through to ungraded.
    const def = {
      id: "c1",
      component: name,
      properties: {
        prompt: "?",
        options: [{ id: "a", label: "A" }],
        correctOptionId: "a",
        items: ["x", "y"],
        correctOrder: ["x", "y"],
        left: [{ id: "l", label: "L" }],
        right: [{ id: "r", label: "R" }],
        correctPairs: [{ leftId: "l", rightId: "r" }],
      },
    } as unknown as ComponentDef;
    const result = gradeAction(
      { componentId: "c1", name: "submit", payload: { optionId: "zzz", order: ["y", "x"], pairs: [] } },
      { c1: def },
    );
    expect(result.verdict).toBe("incorrect");
  });

  it.each(ungraded)("%s is left to the tutor", (name) => {
    const def = { id: "c1", component: name, properties: {} } as unknown as ComponentDef;
    const result = gradeAction({ componentId: "c1", name: "select", payload: { label: "x" } }, { c1: def });
    expect(result.verdict).toBe("ungraded");
  });
});
