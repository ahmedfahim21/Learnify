import type { DiagramGroup, DiagramNode, SystemDiagramProps } from "./catalog";

/**
 * Grid geometry and referential validation for {@link SystemDiagramProps} — no React.
 *
 * The catalog's Zod schema can't express referential integrity (an edge to an
 * unknown node, a step pointing at an edge that doesn't exist), so
 * {@link validateSystemDiagram} covers that gap; it's called from
 * `validatePresentUi` and its messages feed the agent loop's existing one-shot
 * repair round-trip.
 *
 * {@link layoutSystemDiagram} maps the model's coarse grid coordinates to the
 * pixel positions React Flow renders at. Edge *routing* is React Flow's job —
 * its `smoothstep` edge already draws the orthogonal, rounded-corner style this
 * diagram language wants, so none of that geometry lives here.
 */

export const CELL_W = 152;
export const CELL_H = 118;
export const GAP_X = 36;
export const GAP_Y = 48;
export const PAD = 28;
/** Extra room around a group's member bbox, and above it for the label chip. */
const GROUP_PAD = 16;
const GROUP_LABEL_PAD = 22;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LaidOutNode extends Rect {
  id: string;
  node: DiagramNode;
}

export interface LaidOutGroup extends Rect {
  id: string;
  group: DiagramGroup;
}

export interface DiagramLayout {
  width: number;
  height: number;
  nodes: LaidOutNode[];
  nodesById: Map<string, LaidOutNode>;
  groups: LaidOutGroup[];
}

/** Pixel rect for a grid cell span. */
function cellRect(col: number, row: number, colSpan: number, rowSpan: number): Rect {
  return {
    x: PAD + col * (CELL_W + GAP_X),
    y: PAD + row * (CELL_H + GAP_Y),
    w: colSpan * CELL_W + (colSpan - 1) * GAP_X,
    h: rowSpan * CELL_H + (rowSpan - 1) * GAP_Y,
  };
}

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
    // No explicit rect: wrap the group's members, with headroom for the label.
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

  // The canvas has to cover the declared grid and any group overhang.
  const gridW = PAD * 2 + props.columns * CELL_W + (props.columns - 1) * GAP_X;
  const gridH = PAD * 2 + props.rows * CELL_H + (props.rows - 1) * GAP_Y;
  const width = Math.max(gridW, ...groups.map((g) => g.x + g.w + PAD));
  const height = Math.max(gridH, ...groups.map((g) => g.y + g.h + PAD));

  return { width, height, nodes, nodesById, groups };
}

/** Which side of each box an edge should leave from and arrive at, derived
 *  from the two nodes' relative grid position. React Flow draws the path; this
 *  only picks the handles, which is what keeps the routing readable. */
export function handlePair(
  from: DiagramNode,
  to: DiagramNode,
  route?: string,
): { source: "top" | "right" | "bottom" | "left"; target: "top" | "right" | "bottom" | "left" } {
  const sameRow = from.row === to.row;
  const sameCol = from.col === to.col;
  const goingRight = to.col > from.col;
  const goingDown = to.row > from.row;

  if (sameRow && !sameCol) {
    return goingRight ? { source: "right", target: "left" } : { source: "left", target: "right" };
  }
  if (sameCol && !sameRow) {
    return goingDown ? { source: "bottom", target: "top" } : { source: "top", target: "bottom" };
  }
  if (route === "vertical-first") {
    return {
      source: goingDown ? "bottom" : "top",
      target: goingRight ? "left" : "right",
    };
  }
  // "auto" / "horizontal-first": leave sideways, arrive vertically.
  return {
    source: goingRight ? "right" : "left",
    target: goingDown ? "top" : "bottom",
  };
}

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
