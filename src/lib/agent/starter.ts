import { getQuiz } from "@/content/systemDesign/quizzes";
import type { ValidatePresentUiInput } from "../a2ui/emit";

/**
 * The opening screen of a tutor session, taken from authored content.
 *
 * A session used to start on a blank page with "the tutor is working…" while
 * the model composed its first diagnostic — several seconds of nothing, on the
 * one screen where a learner has the least patience and the least reason to
 * trust that anything is happening.
 *
 * The first question does not need a model. The tutor's own opening move is a
 * diagnostic, and every concept already ships a bank of diagnostics written by
 * hand. So the session opens on one of those immediately, and the learner's
 * answer — graded by the same server-side path as any other check — becomes
 * the evidence the model's first real turn starts from. One model call now
 * produces the second screen instead of the first, and it arrives already
 * knowing something about the learner rather than guessing.
 *
 * The starter is seeded into the transcript in exactly the shape the live loop
 * writes, so replay, grading and the model's own view of the conversation need
 * no special case for it.
 */

/** Deterministic, so the client's rendered starter and the server's seeded
 *  copy are the same component and an action can be graded against it. */
export const STARTER_COMPONENT_ID = "starter-check";
const STARTER_SURFACE_ROOT = "starter-root";

/**
 * The authored question a session opens on: the first from the concept's bank
 * that comes from the requirements chapter, since that is where a diagnostic
 * belongs, else the first question in the bank.
 */
export function starterQuestion(problemSlug: string) {
  const bank = getQuiz(problemSlug);
  if (bank.length === 0) return null;
  return bank.find((q) => q.phase === "requirements") ?? bank[0];
}

/**
 * The starter as a `present_ui` payload — the same input the model would have
 * sent, so it flows through `validatePresentUi` and the renderer unchanged.
 */
export function starterPresentUi(problemSlug: string): ValidatePresentUiInput | null {
  const question = starterQuestion(problemSlug);
  if (!question) return null;

  return {
    root: STARTER_SURFACE_ROOT,
    components: [
      {
        id: STARTER_SURFACE_ROOT,
        component: "Column",
        properties: { gap: 4 },
        children: [STARTER_COMPONENT_ID],
      },
      {
        id: STARTER_COMPONENT_ID,
        component: "MultipleChoiceCheck",
        properties: {
          prompt: question.question,
          options: question.options,
          correctOptionId: question.correctOptionId,
        },
      },
    ],
  };
}

/** The tool_result the loop writes after a successful present_ui — matched
 *  exactly, so the seeded exchange is indistinguishable from a real one. */
export const STARTER_TOOL_RESULT = "rendered";

/** Tool-use id for the seeded call. Stable, and namespaced so it can never
 *  collide with an id the model's own tool calls use. */
export const STARTER_TOOL_USE_ID = "toolu_seeded_starter";
