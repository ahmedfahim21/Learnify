/**
 * Deterministic, server-side grading of learner interactions.
 *
 * The tutor presents checks with their answer key embedded in the `present_ui`
 * payload (MCQ `correctOptionId`, OrderingExercise `correctOrder`, MatchingPairs
 * `correctPairs`). When the learner submits, the `/turn` handler grades the
 * answer here — not the model — so correctness never depends on the LLM
 * re-deriving the right answer. The verdict is then injected into the next user
 * message so the tutor adapts (re-teach on wrong, advance on right).
 *
 * Fuzzy interactions (free text, self-rated recall, diagram clicks) have no
 * deterministic key, so they pass through as `ungraded` for the tutor to judge
 * (and to drive `record_evidence`).
 */

import type { ComponentDef } from "../a2ui/messages";
import type { ValidatePresentUiInput } from "../a2ui/emit";

import { EventKind, type StoredEvent } from "./transcript";
import { PRESENT_UI_TOOL_NAME } from "./tools";

/** A learner interaction forwarded from the renderer's action channel. */
export interface LearnerAction {
  /** id of the component that produced the action. */
  componentId: string;
  /** Action name: select | submit_order | submit_pairs | rate_recall | … */
  name: string;
  payload?: Record<string, unknown>;
}

export type Verdict = "correct" | "incorrect" | "ungraded";

export interface GradeResult {
  verdict: Verdict;
  /** The user-turn text to feed the model (the answer + any deterministic verdict). */
  message: string;
}

interface Option {
  id: string;
  label: string;
}

function readOptions(value: unknown): Option[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (o): o is Option =>
      !!o &&
      typeof o === "object" &&
      typeof (o as Option).id === "string" &&
      typeof (o as Option).label === "string",
  );
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

interface Pair {
  leftId: string;
  rightId: string;
}

function readPairs(value: unknown): Pair[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (p): p is Pair =>
      !!p &&
      typeof p === "object" &&
      typeof (p as Pair).leftId === "string" &&
      typeof (p as Pair).rightId === "string",
  );
}

/** Order-independent equality of left→right match sets. */
function pairSetsEqual(a: Pair[], b: Pair[]): boolean {
  if (a.length !== b.length) return false;
  const key = (p: Pair) => `${p.leftId}=>${p.rightId}`;
  const set = new Set(a.map(key));
  return b.every((p) => set.has(key(p)));
}

/**
 * Index every component the tutor has presented this session by id (last write
 * wins, since the tutor can re-emit a component with the same id).
 */
export function collectComponents(
  events: StoredEvent[],
): Record<string, ComponentDef> {
  const index: Record<string, ComponentDef> = {};
  for (const e of [...events].sort((a, b) => a.seq - b.seq)) {
    if (
      e.payload.kind === EventKind.TutorToolUse &&
      e.payload.name === PRESENT_UI_TOOL_NAME
    ) {
      const input = e.payload.input as ValidatePresentUiInput | undefined;
      const components = Array.isArray(input?.components)
        ? (input.components as ComponentDef[])
        : [];
      for (const c of components) {
        if (c && typeof c.id === "string") index[c.id] = c;
      }
    }
  }
  return index;
}

function fallbackLabel(action: LearnerAction): string {
  const label = action.payload?.label;
  return typeof label === "string" && label.trim()
    ? label
    : "(the learner interacted)";
}

/**
 * Grade a learner action against the component that produced it. Returns the
 * verdict plus the exact text to send the model as the next user turn.
 */
export function gradeAction(
  action: LearnerAction,
  components: Record<string, ComponentDef>,
): GradeResult {
  const def = components[action.componentId];
  const label = fallbackLabel(action);
  const payload = action.payload ?? {};

  if (!def) return { verdict: "ungraded", message: label };

  switch (def.component) {
    case "MultipleChoiceCheck": {
      const correctId = def.properties.correctOptionId;
      if (typeof correctId !== "string") return { verdict: "ungraded", message: label };
      const options = readOptions(def.properties.options);
      const chosenId = typeof payload.optionId === "string" ? payload.optionId : "";
      const labelFor = (id: string) => options.find((o) => o.id === id)?.label ?? id;
      const correct = chosenId === correctId;
      const chosenLabel = labelFor(chosenId) || label;
      return correct
        ? {
            verdict: "correct",
            message: `The learner chose "${chosenLabel}". Server grading: CORRECT. Briefly affirm and move on to the next idea.`,
          }
        : {
            verdict: "incorrect",
            message: `The learner chose "${chosenLabel}". Server grading: INCORRECT — the correct answer was "${labelFor(correctId)}". Address that specific misconception before continuing; do not just repeat the question.`,
          };
    }

    case "OrderingExercise": {
      const correctOrder = stringArray(def.properties.correctOrder);
      const submitted = stringArray(payload.orderedIds);
      if (correctOrder.length === 0) {
        return {
          verdict: "ungraded",
          message: `The learner submitted an order: ${label}. Grade it against the correct sequence and respond.`,
        };
      }
      const correct = arraysEqual(correctOrder, submitted);
      const labelOf = new Map(readOptions(def.properties.items).map((i) => [i.id, i.label]));
      const correctLabels = correctOrder.map((id) => labelOf.get(id) ?? id).join(" → ");
      return correct
        ? {
            verdict: "correct",
            message: `The learner ordered the items as: ${label}. Server grading: CORRECT. Affirm and continue.`,
          }
        : {
            verdict: "incorrect",
            message: `The learner ordered the items as: ${label}. Server grading: INCORRECT — the correct order is ${correctLabels}. Explain why that ordering is right before continuing.`,
          };
    }

    case "MatchingPairs": {
      const correctPairs = readPairs(def.properties.correctPairs);
      const submitted = readPairs(payload.pairs);
      if (correctPairs.length === 0) {
        return {
          verdict: "ungraded",
          message: `The learner submitted matches: ${label}. Grade them against the correct pairing and respond.`,
        };
      }
      const correct = pairSetsEqual(correctPairs, submitted);
      const leftLabel = new Map(readOptions(def.properties.left).map((i) => [i.id, i.label]));
      const rightLabel = new Map(readOptions(def.properties.right).map((i) => [i.id, i.label]));
      const correctLabels = correctPairs
        .map((p) => `${leftLabel.get(p.leftId) ?? p.leftId} → ${rightLabel.get(p.rightId) ?? p.rightId}`)
        .join("; ");
      return correct
        ? {
            verdict: "correct",
            message: `The learner matched: ${label}. Server grading: CORRECT. Affirm and continue.`,
          }
        : {
            verdict: "incorrect",
            message: `The learner matched: ${label}. Server grading: INCORRECT — the correct matches are: ${correctLabels}. Clear up the mismatches before continuing.`,
          };
    }

    default:
      // Flashcard recall, FreeResponse, Diagram clicks: fuzzy — the tutor
      // judges these and may call record_evidence.
      return { verdict: "ungraded", message: label };
  }
}
