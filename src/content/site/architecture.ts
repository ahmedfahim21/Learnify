import type { SystemDiagramProps } from "@/lib/a2ui/catalog";

/**
 * The generative-UI loop, drawn with the same widget the tutor draws with.
 *
 * Typed as SystemDiagramProps and validated by the same `validateSystemDiagram`
 * every model-emitted diagram faces — so this page is itself an instance of the
 * thing it describes.
 */
export const A2UI_LOOP: SystemDiagramProps = {
  title: "One turn of the loop",
  columns: 5,
  rows: 3,
  nodes: [
    {
      id: "learner",
      label: "Learner",
      detail:
        "Answers a check, reorders a list, clicks a node. Every interaction is an A2UI action message naming the component that produced it.",
      icon: "user",
      col: 0,
      row: 1,
    },
    {
      id: "log",
      label: "Event log",
      sublabel: "append-only",
      detail:
        "Every turn, tool call and result is persisted with a monotonic sequence number. The conversation sent to the model is rebuilt from it on each request, which is what makes a dropped stream resumable rather than lost.",
      icon: "database",
      col: 1,
      row: 2,
      accent: "purple",
    },
    {
      id: "loop",
      label: "Agent loop",
      sublabel: "4 tools",
      detail:
        "Rebuilds the transcript, then streams from Claude on Bedrock. The model can call present_ui, update_plan, record_evidence or end_session — and nothing else.",
      icon: "agent",
      col: 1,
      row: 0,
      accent: "blue",
    },
    {
      id: "validate",
      label: "Catalog validation",
      sublabel: "Zod union",
      detail:
        "Every component is parsed against a 15-branch discriminated union plus referential checks Zod cannot express. Invalid output is returned to the model as an error result and repaired in one round trip — it never reaches the browser.",
      icon: "firewall",
      col: 2,
      row: 0,
      accent: "amber",
      shape: "hexagon",
    },
    {
      id: "grading",
      label: "Server grading",
      detail:
        "Multiple choice, ordering and matching are graded against the answer key embedded in the original payload. Correctness never depends on the model re-deriving it, and the verdict is injected into the next turn.",
      icon: "function",
      col: 2,
      row: 2,
      accent: "green",
    },
    {
      id: "renderer",
      label: "Renderer",
      sublabel: "interprets data",
      detail:
        "Maps validated component definitions onto React components from a fixed registry. It reads values and never evaluates anything the model wrote — the security property that makes model-composed UI safe to render.",
      icon: "browser",
      col: 3,
      row: 0,
      accent: "blue",
    },
    {
      id: "screen",
      label: "The screen",
      detail:
        "Diagrams, simulators, checks and recaps — composed by the model per turn from the catalog, not selected from prewritten templates.",
      icon: "web",
      col: 4,
      row: 1,
      accent: "green",
    },
  ],
  edges: [
    { id: "a1", from: "learner", to: "log", step: 1, label: "action", route: "vertical-first" },
    { id: "a2", from: "log", to: "loop", step: 2, label: "rebuild transcript" },
    { id: "a3", from: "loop", to: "validate", step: 3, label: "present_ui" },
    { id: "a4", from: "validate", to: "loop", step: 4, label: "invalid: repair", style: "dashed" },
    { id: "a5", from: "validate", to: "renderer", step: 5, label: "valid: stream" },
    { id: "a6", from: "renderer", to: "screen", step: 6 },
    { id: "a7", from: "learner", to: "grading", step: 7, label: "graded here", route: "vertical-first" },
  ],
  steps: [
    {
      index: 1,
      caption: "The learner acts. The interaction is appended to the log before anything else happens.",
      nodeIds: ["learner", "log"],
      edgeIds: ["a1"],
    },
    {
      index: 2,
      caption: "The conversation is rebuilt from the log, so a dropped stream resumes instead of restarting.",
      nodeIds: ["log", "loop"],
      edgeIds: ["a2"],
    },
    {
      index: 3,
      caption: "Claude replies by calling present_ui with declarative components — not prose, not code.",
      nodeIds: ["loop", "validate"],
      edgeIds: ["a3"],
    },
    {
      index: 4,
      caption: "Anything outside the catalog is rejected and handed back for one repair attempt.",
      nodeIds: ["validate", "loop"],
      edgeIds: ["a4"],
    },
    {
      index: 5,
      caption: "Only validated components are streamed to the browser.",
      nodeIds: ["validate", "renderer"],
      edgeIds: ["a5"],
    },
    {
      index: 6,
      caption: "The renderer maps data onto React components. It evaluates nothing the model wrote.",
      nodeIds: ["renderer", "screen"],
      edgeIds: ["a6"],
    },
    {
      index: 7,
      caption: "The next answer is graded on the server against the key in the original payload.",
      nodeIds: ["learner", "grading"],
      edgeIds: ["a7"],
    },
  ],
};
