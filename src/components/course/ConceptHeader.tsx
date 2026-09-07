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

const BAND_W = 1200;
const BAND_H = 300;

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
  const gridId = `grid-${problem.slug}`;
  const fadeId = `fade-${problem.slug}`;

  const layout = diagram ? layoutSystemDiagram(diagram) : null;

  return (
    <div className="relative overflow-hidden border border-(--color-line) bg-(--color-canvas)">
      <svg viewBox={`0 0 ${BAND_W} ${BAND_H}`} aria-hidden className="block h-32 w-full sm:h-40">
        <defs>
          <pattern id={gridId} width={24} height={24} patternUnits="userSpaceOnUse">
            <circle cx={1} cy={1} r={1} fill="var(--color-line)" />
          </pattern>
          {/* The drawing runs off the right edge rather than sitting centred in
              a box — it reads as a fragment of something larger, which is what
              a header is. */}
          <linearGradient id={fadeId} x1="0" x2="1">
            <stop offset="0.45" stopColor="white" stopOpacity="1" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id={`m-${problem.slug}`}>
            <rect width={BAND_W} height={BAND_H} fill={`url(#${fadeId})`} />
          </mask>
        </defs>

        <rect width={BAND_W} height={BAND_H} fill={`url(#${gridId})`} />

        {layout && (
          <g
            mask={`url(#m-${problem.slug})`}
            transform={`translate(${BAND_W * 0.42} ${BAND_H / 2}) scale(${
              Math.min(1.5, (BAND_H * 0.8) / Math.max(layout.height, 1))
            }) translate(${-layout.width / 2} ${-layout.height / 2})`}
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
                  stroke="var(--color-faint)"
                  strokeWidth={2}
                  opacity={0.45}
                />
              );
            })}
            {layout.nodes.map((laid) => (
              <rect
                key={laid.id}
                x={laid.x}
                y={laid.y}
                width={laid.w}
                height={laid.h}
                rx={4}
                fill="var(--color-node)"
                stroke={laid.node.accent ? accent : "var(--color-faint)"}
                strokeWidth={2}
                opacity={laid.node.accent ? 1 : 0.6}
              />
            ))}
          </g>
        )}

        {/* A rule in the concept's own colour, so the band is never just grey
            even for a concept whose diagram is small. */}
        <rect x={0} y={BAND_H - 4} width={BAND_W * 0.28} height={4} fill={accent} />
      </svg>
    </div>
  );
}
