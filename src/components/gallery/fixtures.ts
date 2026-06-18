import { A2UI_VERSION, type CreateSurfaceMessage, type ComponentDef } from "@/lib/a2ui/messages";

/**
 * Fixture A2UI JSON for the dev-only widget gallery (`/gallery`).
 *
 * Each entry is a self-contained `createSurface` envelope rendering one widget
 * (or one layout composition) so the whole v1 catalog can be eyeballed — and
 * each interactive widget's action event exercised — without a live tutor.
 */

function surface(name: string, root: string, components: ComponentDef[]): CreateSurfaceMessage {
  return {
    type: "createSurface",
    version: A2UI_VERSION,
    surfaceId: `gallery:${name}`,
    root,
    components,
  };
}

export interface GalleryFixture {
  name: string;
  message: CreateSurfaceMessage;
}

export const GALLERY_FIXTURES: GalleryFixture[] = [
  {
    name: "Narration",
    message: surface("narration", "n", [
      {
        id: "n",
        component: "Narration",
        properties: {
          text: "Let's warm up. **Bayes' theorem** updates a belief as evidence arrives — start with intuition, then the formula.",
        },
      },
    ]),
  },
  {
    name: "ExplanationCard",
    message: surface("explanation", "e", [
      {
        id: "e",
        component: "ExplanationCard",
        properties: {
          title: "Conditional probability",
          body: "`P(A|B)` is the probability of A *given* B has happened. It re-weights the sample space to only the worlds where B is true.",
          emoji: "🎯",
        },
      },
    ]),
  },
  {
    name: "MultipleChoiceCheck",
    message: surface("mcq", "q", [
      {
        id: "q",
        component: "MultipleChoiceCheck",
        properties: {
          prompt: "If P(B) = 0, what is P(A|B)?",
          options: [
            { id: "o1", label: "Zero" },
            { id: "o2", label: "One" },
            { id: "o3", label: "Undefined" },
          ],
          correctOptionId: "o3",
          explanation: "Conditioning on a zero-probability event is undefined — you can't divide by zero.",
        },
      },
    ]),
  },
  {
    name: "Flashcard",
    message: surface("flashcard", "f", [
      {
        id: "f",
        component: "Flashcard",
        properties: {
          front: "What does the **prior** represent?",
          back: "Your belief about a hypothesis *before* seeing the new evidence.",
          hint: "Think: what you knew beforehand.",
        },
      },
    ]),
  },
  {
    name: "OrderingExercise",
    message: surface("ordering", "o", [
      {
        id: "o",
        component: "OrderingExercise",
        properties: {
          prompt: "Put the Bayesian update steps in order.",
          items: [
            { id: "i2", label: "Multiply by the likelihood" },
            { id: "i1", label: "Start with the prior" },
            { id: "i4", label: "Normalize to get the posterior" },
            { id: "i3", label: "Combine across hypotheses" },
          ],
          correctOrder: ["i1", "i2", "i3", "i4"],
        },
      },
    ]),
  },
  {
    name: "MatchingPairs",
    message: surface("matching", "m", [
      {
        id: "m",
        component: "MatchingPairs",
        properties: {
          prompt: "Match each term to its meaning.",
          left: [
            { id: "l1", label: "Prior" },
            { id: "l2", label: "Likelihood" },
            { id: "l3", label: "Posterior" },
          ],
          right: [
            { id: "r2", label: "P(evidence | hypothesis)" },
            { id: "r3", label: "Updated belief after evidence" },
            { id: "r1", label: "Belief before evidence" },
          ],
          correctPairs: [
            { leftId: "l1", rightId: "r1" },
            { leftId: "l2", rightId: "r2" },
            { leftId: "l3", rightId: "r3" },
          ],
        },
      },
    ]),
  },
  {
    name: "CodeSnippet",
    message: surface("code", "c", [
      {
        id: "c",
        component: "CodeSnippet",
        properties: {
          language: "python",
          caption: "A direct application of Bayes' theorem.",
          highlightLines: [4],
          code: "def posterior(prior, likelihood, evidence):\n    # P(H|E) = P(E|H) * P(H) / P(E)\n    if evidence == 0:\n        return None  # undefined\n    return likelihood * prior / evidence",
        },
      },
    ]),
  },
  {
    name: "Diagram",
    message: surface("diagram", "d", [
      {
        id: "d",
        component: "Diagram",
        properties: {
          caption: "Click a node to drill into that step.",
          source:
            "graph TD;\n  A[Prior P(H)] --> C[Posterior P(H|E)];\n  B[Likelihood P(E|H)] --> C;\n  C --> D[Decision];",
        },
      },
    ]),
  },
  {
    name: "FreeResponse",
    message: surface("free", "fr", [
      {
        id: "fr",
        component: "FreeResponse",
        properties: {
          prompt: "In one sentence, explain why the posterior depends on the prior.",
          placeholder: "Because…",
        },
      },
    ]),
  },
  {
    name: "ProgressMeter",
    message: surface("progress", "p", [
      {
        id: "p",
        component: "ProgressMeter",
        properties: {
          phase: "Practice",
          concepts: [
            { label: "Conditional probability", mastery: 0.8 },
            { label: "Bayes' theorem", mastery: 0.45 },
            { label: "Priors vs posteriors", mastery: 0.2 },
          ],
        },
      },
    ]),
  },
  {
    name: "SessionRecap",
    message: surface("recap", "s", [
      {
        id: "s",
        component: "SessionRecap",
        properties: {
          summary: "You connected conditional probability to the full Bayesian update.",
          keyPoints: [
            "Posterior ∝ prior × likelihood",
            "Conditioning on a zero-probability event is undefined",
            "Evidence re-weights, it doesn't replace, the prior",
          ],
          nextUp: "Naive Bayes classifiers",
        },
      },
    ]),
  },
  {
    name: "Layout (Column + Row)",
    message: surface("layout", "col", [
      {
        id: "col",
        component: "Column",
        properties: { gap: 4 },
        children: ["card", "row"],
      },
      {
        id: "card",
        component: "ExplanationCard",
        properties: {
          title: "Containers compose",
          body: "Row and Column reference children by id (flat adjacency).",
        },
      },
      {
        id: "row",
        component: "Row",
        properties: { gap: 4 },
        children: ["pm", "fc"],
      },
      {
        id: "pm",
        component: "ProgressMeter",
        properties: { concepts: [{ label: "Layout", mastery: 1 }] },
      },
      {
        id: "fc",
        component: "Flashcard",
        properties: { front: "Nested in a Row", back: "Rendered side by side." },
      },
    ]),
  },
];
