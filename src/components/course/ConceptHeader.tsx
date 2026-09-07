import { getPrimaryDiagram } from "@/content/systemDesign";
import { SKILL_TAG_ACCENT, type SkillTag } from "@/content/systemDesign/tags";
import type { SystemDesignProblem } from "@/content/systemDesign/types";
import { layoutSystemDiagram } from "@/lib/a2ui/diagram";

/**
 * The banner at the top of a concept.
 *
 * Drawn from that concept's own primary diagram, so no two are alike and the
 * shape is a true fingerprint of the system — a fan-out looks like a fan-out,
 * a pipeline looks like a pipeline. Labels are dropped: at banner scale they
 * would be unreadable, and the readable copy of the diagram is a few hundred
 * pixels below. This is an establishing shot, not a second diagram.
 *
 * Server-rendered plain SVG. It is the first paint on every concept page, so
 * it has no business being a React Flow instance or waiting on hydration.
 */

/** Padding around the drawing, in the diagram's own units. */
const PAD = 26;

/** The accent that appears most across a concept's skills — its colour. */
function dominantAccent(problem: SystemDesignProblem): string {
  const counts = new Map<string, number>();
  for (const chapter of problem.chapters) {
    for (const skill of chapter.concepts) {
      for (const tag of skill.tags as SkillTag[]) {
        const accent = SKILL_TAG_ACCENT[tag];
        counts.set(accent, (counts.get(accent) ?? 0) + 1);
      }
    }
  }
  let best = "signal";
  let bestCount = -1;
  // Sorted so the winner is stable when two accents tie, rather than depending
  // on Map insertion order shifting with a content edit.
  for (const [accent, count] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (count > bestCount) {
      best = accent;
      bestCount = count;
    }
  }
  return best;
}

export function ConceptHeaderGraphic({ problem }: { problem: SystemDesignProblem }) {
  const diagram = getPrimaryDiagram(problem);
  const accent = `var(--color-${dominantAccent(problem)})`;
  const layout = diagram ? layoutSystemDiagram(diagram) : null;

  return (
    <div
      className="relative overflow-hidden border border-(--color-line) bg-(--color-canvas)"
      // The dotted ground and the accent rule belong to the band, not the
      // drawing. Keeping them in CSS means they span the full width whatever
      // aspect ratio the container ends up at, while the SVG is free to fit
      // the diagram without dragging the background around with it.
      style={{
        backgroundImage: "radial-gradient(var(--color-line) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      {layout && (
        // The viewBox is the drawing's own bounds rather than a fixed band, so
        // the diagram fills the available height at any container width. A
        // fixed 4:1 band left it floating at 40% scale in a sea of dots.
        <svg
          viewBox={`${-PAD} ${-PAD} ${layout.width + PAD * 2} ${layout.height + PAD * 2}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
          className="block h-32 w-full sm:h-44"
        >
          {diagram?.edges.map((edge) => {
            const from = layout.nodesById.get(edge.from);
            const to = layout.nodesById.get(edge.to);
            if (!from || !to) return null;
            return (
              <line
                key={edge.id}
                x1={from.x + from.w / 2}
                y1={from.y + from.h / 2}
                x2={to.x + to.w / 2}
                y2={to.y + to.h / 2}
                stroke={accent}
                strokeWidth={3}
                opacity={0.3}
              />
            );
          })}
          {layout.nodes.map((laid, i) => (
            <rect
              key={laid.id}
              x={laid.x}
              y={laid.y}
              width={laid.w}
              height={laid.h}
              rx={5}
              // Every box takes the concept's colour, a third of them filled:
              // an all-grey outline drawing read as absent rather than subtle,
              // and left every concept looking like every other one.
              fill={i % 3 === 0 ? accent : "var(--color-node)"}
              fillOpacity={i % 3 === 0 ? 0.14 : 1}
              stroke={accent}
              strokeWidth={3}
              opacity={laid.node.accent ? 1 : 0.55}
            />
          ))}
        </svg>
      )}

      {/* Never just grey, even for a concept whose diagram is small. */}
      <span className="absolute bottom-0 left-0 h-1 w-1/4" style={{ background: accent }} />
    </div>
  );
}
