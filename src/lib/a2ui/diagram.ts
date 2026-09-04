import type {
  DiagramEdge,
  DiagramGroup,
  DiagramNode,
  SystemDiagramProps,
} from "./catalog";

/**
 * Pure geometry and validation for {@link SystemDiagramProps} — no React.
 *
 * The catalog's Zod schema can't express referential integrity (an edge to an
 * unknown node, a step pointing at an edge that doesn't exist), so
 * {@link validateSystemDiagram} covers that gap; it's called from
 * `validatePresentUi` and its messages feed the agent loop's existing one-shot
 * repair round-trip.
 *
 * {@link layoutSystemDiagram} and {@link routeEdge} turn the model's grid
 * coordinates into pixel geometry the renderer draws directly — orthogonal
 * routing with rounded corners, matching the ByteByteGo reference style rather
 * than an auto-layout tool's bezier curves.
 */

export const CELL_W = 152;
export const CELL_H = 118;
export const GAP_X = 36;
export const GAP_Y = 48;
export const PAD = 28;
/** Extra room above a group's member bbox, reserved for its label chip. */
const GROUP_PAD = 16;
const GROUP_LABEL_PAD = 22;
/** Perpendicular offset step between parallel edges sharing the same pair. */
const PARALLEL_OFFSET = 10;
/** Corner radius for orthogonal edge routing. */
const CORNER_RADIUS = 12;

export interface Point {
  x: number;
  y: number;
}

export interface LaidOutNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  node: DiagramNode;
}

export interface LaidOutGroup {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  group: DiagramGroup;
}

export interface LaidOutEdge {
  id: string;
  points: Point[];
  d: string;
  length: number;
  badge?: Point;
  labelAt?: Point;
  edge: DiagramEdge;
}

export interface DiagramLayout {
  width: number;
  height: number;
  nodes: LaidOutNode[];
  nodesById: Map<string, LaidOutNode>;
  groups: LaidOutGroup[];
  edges: LaidOutEdge[];
}

function cellRect(col: number, row: number, colSpan = 1, rowSpan = 1) {
  const x = PAD + col * (CELL_W + GAP_X);
  const y = PAD + row * (CELL_H + GAP_Y);
  const w = colSpan * CELL_W + Math.max(0, colSpan - 1) * GAP_X;
  const h = rowSpan * CELL_H + Math.max(0, rowSpan - 1) * GAP_Y;
  return { x, y, w, h };
}

/** Port side a box exposes toward a neighbour, and the point on that side. */
type Side = "top" | "right" | "bottom" | "left";

function portPoint(rect: { x: number; y: number; w: number; h: number }, side: Side): Point {
  switch (side) {
    case "top":
      return { x: rect.x + rect.w / 2, y: rect.y };
    case "bottom":
      return { x: rect.x + rect.w / 2, y: rect.y + rect.h };
    case "left":
      return { x: rect.x, y: rect.y + rect.h / 2 };
    case "right":
      return { x: rect.x + rect.w, y: rect.y + rect.h / 2 };
  }
}

/**
 * Lay out a diagram's nodes and groups on the pixel grid. Group geometry uses
 * its explicit rect when given, else the padded bounding box of its members —
 * so the model can tint a tier without hand-computing its extent.
 */
export function layoutSystemDiagram(props: SystemDiagramProps): DiagramLayout {
  const nodes: LaidOutNode[] = props.nodes.map((node) => ({
    id: node.id,
    ...cellRect(node.col, node.row, node.colSpan ?? 1, node.rowSpan ?? 1),
    node,
  }));
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  const groups: LaidOutGroup[] = (props.groups ?? []).map((group) => {
    if (
      group.col !== undefined &&
      group.row !== undefined &&
      group.colSpan !== undefined &&
      group.rowSpan !== undefined
    ) {
      const rect = cellRect(group.col, group.row, group.colSpan, group.rowSpan);
      return {
        id: group.id,
        x: rect.x - GROUP_PAD,
        y: rect.y - GROUP_PAD - GROUP_LABEL_PAD,
        w: rect.w + GROUP_PAD * 2,
        h: rect.h + GROUP_PAD * 2 + GROUP_LABEL_PAD,
        group,
      };
    }
    const members = nodes.filter((n) => n.node.groupId === group.id);
    if (members.length === 0) {
      return { id: group.id, x: PAD, y: PAD, w: CELL_W, h: CELL_H, group };
    }
    const minX = Math.min(...members.map((m) => m.x));
    const minY = Math.min(...members.map((m) => m.y));
    const maxX = Math.max(...members.map((m) => m.x + m.w));
    const maxY = Math.max(...members.map((m) => m.y + m.h));
    return {
      id: group.id,
      x: minX - GROUP_PAD,
      y: minY - GROUP_PAD - GROUP_LABEL_PAD,
      w: maxX - minX + GROUP_PAD * 2,
      h: maxY - minY + GROUP_PAD * 2 + GROUP_LABEL_PAD,
      group,
    };
  });

  // Parallel-edge grouping: same unordered pair gets a perpendicular fan-out,
  // computed before per-edge routing so every member of a group knows its index.
  const pairKey = (e: DiagramEdge) => [e.from, e.to].sort().join("|");
  const parallelIndex = new Map<string, number>();
  const parallelCounts = new Map<string, number>();
  for (const edge of props.edges) {
    const key = pairKey(edge);
    parallelCounts.set(key, (parallelCounts.get(key) ?? 0) + 1);
  }
  const seen = new Map<string, number>();

  const edges: LaidOutEdge[] = props.edges.map((edge) => {
    const key = pairKey(edge);
    const total = parallelCounts.get(key) ?? 1;
    const seenSoFar = seen.get(key) ?? 0;
    seen.set(key, seenSoFar + 1);
    // Centre the fan-out around 0: for 3 parallel edges, offsets are -1,0,1.
    const offsetIndex = seenSoFar - (total - 1) / 2;
    parallelIndex.set(edge.id, offsetIndex);

    const from = nodesById.get(edge.from);
    const to = nodesById.get(edge.to);
    if (!from || !to) {
      // Referential problems are caught by validateSystemDiagram before this
      // ever runs in the renderer; keep this branch total for standalone tests.
      return {
        id: edge.id,
        points: [],
        d: "",
        length: 0,
        edge,
      };
    }

    const points = routeEdge(from, to, edge.route ?? "auto", offsetIndex * PARALLEL_OFFSET);
    const d = pointsToPath(points, CORNER_RADIUS);
    const length = pathLength(points);
    const mid = pointAtLength(points, length / 2);
    const hasBadge = edge.step !== undefined;
    return {
      id: edge.id,
      points,
      d,
      length,
      badge: hasBadge ? mid : undefined,
      labelAt: edge.label
        ? hasBadge
          ? offsetPerpendicular(points, length / 2, 16)
          : mid
        : undefined,
      edge,
    };
  });

  const maxGroupX = groups.reduce((m, g) => Math.max(m, g.x + g.w), 0);
  const maxGroupY = groups.reduce((m, g) => Math.max(m, g.y + g.h), 0);
  const width = Math.max(PAD * 2 + props.columns * CELL_W + Math.max(0, props.columns - 1) * GAP_X, maxGroupX + PAD);
  const height = Math.max(PAD * 2 + props.rows * CELL_H + Math.max(0, props.rows - 1) * GAP_Y, maxGroupY + PAD);

  return { width, height, nodes, nodesById, groups, edges };
}

/**
 * Route an edge between two grid boxes as a small point sequence. Same
 * row/col ⇒ a straight line between the facing ports; otherwise a single
 * elbow, exiting the source box and turning once toward the target's centre
 * line. `perpOffset` fans parallel edges between the same pair apart.
 */
export function routeEdge(
  from: LaidOutNode,
  to: LaidOutNode,
  route: "auto" | "horizontal-first" | "vertical-first" | "straight",
  perpOffset = 0,
): Point[] {
  if (from.id === to.id) {
    // Self-loop: a small hook out of the top-right corner and back.
    const top = portPoint(from, "top");
    const right = portPoint(from, "right");
    return [
      { x: right.x, y: right.y - from.h / 4 },
      { x: right.x + 28, y: right.y - from.h / 4 },
      { x: right.x + 28, y: top.y - 20 },
      { x: top.x, y: top.y - 20 },
      { x: top.x, y: top.y },
    ];
  }

  const sameRow = Math.abs(from.y - to.y) < 1;
  const sameCol = Math.abs(from.x - to.x) < 1;

  if (route === "straight") {
    const fromCenter = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
    const toCenter = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
    return [clipToEdge(from, toCenter, perpOffset), clipToEdge(to, fromCenter, perpOffset)];
  }

  if (sameRow) {
    const goingRight = to.x > from.x;
    const p1 = portPoint(from, goingRight ? "right" : "left");
    const p2 = portPoint(to, goingRight ? "left" : "right");
    return offsetPoints([p1, p2], perpOffset, "vertical");
  }

  if (sameCol) {
    const goingDown = to.y > from.y;
    const p1 = portPoint(from, goingDown ? "bottom" : "top");
    const p2 = portPoint(to, goingDown ? "top" : "bottom");
    return offsetPoints([p1, p2], perpOffset, "horizontal");
  }

  const goingRight = to.x + to.w / 2 > from.x + from.w / 2;
  const goingDown = to.y + to.h / 2 > from.y + from.h / 2;

  if (route === "vertical-first") {
    const p1 = portPoint(from, goingDown ? "bottom" : "top");
    const p3 = portPoint(to, goingRight ? "left" : "right");
    const p2 = { x: p1.x, y: p3.y };
    return [p1, p2, p3];
  }

  // "auto" and "horizontal-first": exit horizontally, turn at the target's centre-x.
  const p1 = portPoint(from, goingRight ? "right" : "left");
  const p3 = portPoint(to, goingDown ? "top" : "bottom");
  const p2 = { x: p3.x, y: p1.y };
  return [p1, p2, p3];
}

/** Nudge every point in a route perpendicular to its dominant axis. */
function offsetPoints(points: Point[], offset: number, axis: "horizontal" | "vertical"): Point[] {
  if (offset === 0) return points;
  return points.map((p) =>
    axis === "vertical" ? { x: p.x, y: p.y + offset } : { x: p.x + offset, y: p.y },
  );
}

/** For the "straight" route: clip a centre-to-centre line to the box's edge. */
function clipToEdge(rect: { x: number; y: number; w: number; h: number }, toward: Point, perpOffset: number): Point {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  const scaleX = dx !== 0 ? rect.w / 2 / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? rect.h / 2 / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  const x = cx + dx * scale;
  const y = cy + dy * scale;
  const perpX = Math.abs(dx) > Math.abs(dy) ? 0 : perpOffset;
  const perpY = Math.abs(dx) > Math.abs(dy) ? perpOffset : 0;
  return { x: x + perpX, y: y + perpY };
}

/** Turn a point sequence into an SVG path with quarter-arc rounded corners. */
export function pointsToPath(points: Point[], radius = CORNER_RADIUS): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const inLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const outLen = Math.hypot(next.x - curr.x, next.y - curr.y);
    const r = Math.min(radius, inLen / 2, outLen / 2);

    const inRatio = r / (inLen || 1);
    const outRatio = r / (outLen || 1);
    const beforeCorner = {
      x: curr.x - (curr.x - prev.x) * inRatio,
      y: curr.y - (curr.y - prev.y) * inRatio,
    };
    const afterCorner = {
      x: curr.x + (next.x - curr.x) * outRatio,
      y: curr.y + (next.y - curr.y) * outRatio,
    };

    d += ` L ${beforeCorner.x} ${beforeCorner.y}`;
    if (r > 0.5) {
      d += ` Q ${curr.x} ${curr.y} ${afterCorner.x} ${afterCorner.y}`;
    }
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

/** Total length of a polyline (the rounding in {@link pointsToPath} is a small
 *  enough perturbation that the straight-segment sum is a good approximation
 *  for badge/packet placement). */
export function pathLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

/** The point at `distance` along a polyline, clamped to its ends. */
export function pointAtLength(points: Point[], distance: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1 || distance <= 0) return points[0];
  let remaining = distance;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= segLen || i === points.length - 1) {
      const t = segLen === 0 ? 0 : Math.min(1, remaining / segLen);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= segLen;
  }
  return points[points.length - 1];
}

/** A point offset perpendicular to the polyline's local direction at `distance`. */
function offsetPerpendicular(points: Point[], distance: number, offset: number): Point {
  const p = pointAtLength(points, distance);
  const ahead = pointAtLength(points, distance + 1);
  const dx = ahead.x - p.x;
  const dy = ahead.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: p.x + (-dy / len) * offset, y: p.y + (dx / len) * offset };
}

/**
 * Structural problems Zod can't express: dangling references, out-of-bounds
 * placement, and step sequencing. Returns human-readable messages fed straight
 * back to the model as an `is_error` tool_result.
 */
export function validateSystemDiagram(props: SystemDiagramProps): string[] {
  const problems: string[] = [];

  if (props.columns > 8 || props.rows > 8) {
    problems.push(
      `grid is ${props.columns}x${props.rows}; keep it to 8 columns and 8 rows or fewer for a readable composition.`,
    );
  }

  const nodeIds = new Set<string>();
  for (const node of props.nodes) {
    if (nodeIds.has(node.id)) problems.push(`duplicate node id "${node.id}".`);
    nodeIds.add(node.id);
    const colSpan = node.colSpan ?? 1;
    const rowSpan = node.rowSpan ?? 1;
    if (node.col < 0 || node.row < 0 || node.col + colSpan > props.columns || node.row + rowSpan > props.rows) {
      problems.push(`node "${node.id}" at col ${node.col}, row ${node.row} falls outside the ${props.columns}x${props.rows} grid.`);
    }
  }

  const groupIds = new Set<string>();
  for (const group of props.groups ?? []) {
    if (groupIds.has(group.id)) problems.push(`duplicate group id "${group.id}".`);
    groupIds.add(group.id);
  }

  for (const node of props.nodes) {
    if (node.groupId && !groupIds.has(node.groupId)) {
      problems.push(`node "${node.id}" references unknown group "${node.groupId}".`);
    }
  }

  const edgeIds = new Set<string>();
  for (const edge of props.edges) {
    if (edgeIds.has(edge.id)) problems.push(`duplicate edge id "${edge.id}".`);
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.from)) problems.push(`edge "${edge.id}" references unknown source node "${edge.from}".`);
    if (!nodeIds.has(edge.to)) problems.push(`edge "${edge.id}" references unknown target node "${edge.to}".`);
  }

  // Overlapping cells: two nodes claiming the same grid cell read as one box.
  const claimed = new Map<string, string>();
  for (const node of props.nodes) {
    const colSpan = node.colSpan ?? 1;
    const rowSpan = node.rowSpan ?? 1;
    for (let c = node.col; c < node.col + colSpan; c++) {
      for (let r = node.row; r < node.row + rowSpan; r++) {
        const key = `${c},${r}`;
        const owner = claimed.get(key);
        if (owner && owner !== node.id) {
          problems.push(`nodes "${owner}" and "${node.id}" overlap at cell (${c}, ${r}).`);
        }
        claimed.set(key, node.id);
      }
    }
  }

  if (props.steps && props.steps.length > 0) {
    const sorted = [...props.steps].sort((a, b) => a.index - b.index);
    sorted.forEach((step, i) => {
      const expected = i + 1;
      if (step.index !== expected) {
        problems.push(`steps must be a contiguous 1..N sequence; found index ${step.index} where ${expected} was expected.`);
      }
      for (const id of step.nodeIds) {
        if (!nodeIds.has(id)) problems.push(`step ${step.index} references unknown node "${id}".`);
      }
      for (const id of step.edgeIds) {
        if (!edgeIds.has(id)) problems.push(`step ${step.index} references unknown edge "${id}".`);
      }
    });
  }

  return problems;
}
