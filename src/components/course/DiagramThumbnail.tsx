import { layoutSystemDiagram } from "@/lib/a2ui/diagram";
import type { SystemDiagramProps } from "@/lib/a2ui/catalog";

/**
 * A course's architecture, drawn small.
 *
 * Derived from the same authored diagram the course actually teaches, so every
 * card carries a true fingerprint of its shape — a fan-out looks like a
 * fan-out, a pipeline looks like a pipeline — rather than generic art. It is
 * plain SVG rather than a React Flow instance because a catalog renders
 * sixteen of these at once and none of them need to be interactive.
 *
 * Decorative: `aria-hidden`, since the card's own text already names the
 * course and a screen reader gains nothing from an unlabelled box diagram.
 */
export function DiagramThumbnail({
  diagram,
  className = "",
}: {
  diagram: SystemDiagramProps;
  className?: string;
}) {
  const layout = layoutSystemDiagram(diagram);
  const byId = layout.nodesById;

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
      className={`w-full ${className}`}
    >
      {layout.groups.map((group) => (
        <rect
          key={group.id}
          x={group.x}
          y={group.y}
          width={group.w}
          height={group.h}
          rx={8}
          className="fill-(--color-raised)/60"
        />
      ))}

      {diagram.edges.map((edge) => {
        const from = byId.get(edge.from);
        const to = byId.get(edge.to);
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
            opacity={0.5}
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
          rx={6}
          // DIAGRAM_COLORS names map 1:1 onto the --diagram-* stroke variables.
          stroke={laid.node.accent ? `var(--diagram-${laid.node.accent})` : "var(--color-faint)"}
          strokeWidth={2}
          className="fill-(--color-node)"
        />
      ))}
    </svg>
  );
}
