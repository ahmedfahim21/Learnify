import { describe, expect, it } from "vitest";

import {
  CELL_H,
  CELL_W,
  GAP_X,
  GAP_Y,
  PAD,
  layoutSystemDiagram,
  pathLength,
  pointAtLength,
  pointsToPath,
  routeEdge,
  validateSystemDiagram,
} from "./diagram";
import type { SystemDiagramProps } from "./catalog";

const RAG_DIAGRAM: SystemDiagramProps = {
  columns: 5,
  rows: 3,
  nodes: [
    { id: "user", label: "User", col: 0, row: 1, icon: "user" },
    { id: "server", label: "Server", col: 1, row: 1, icon: "service" },
    { id: "search", label: "Search", col: 2, row: 1, icon: "search-index" },
    { id: "pdf", label: "PDF", col: 3, row: 0, icon: "document", groupId: "sources" },
    { id: "db", label: "Database", col: 3, row: 1, icon: "database", groupId: "sources" },
    { id: "gpt", label: "GPT", col: 4, row: 1, icon: "llm", groupId: "llms" },
  ],
  groups: [
    { id: "sources", label: "Knowledge Sources", color: "pink" },
    { id: "llms", label: "Large Language Models", color: "green" },
  ],
  edges: [
    { id: "e1", from: "user", to: "server", step: 1 },
    { id: "e2", from: "server", to: "search", step: 2 },
    { id: "e3", from: "search", to: "db", step: 3 },
    { id: "e4", from: "db", to: "server", step: 4 },
    { id: "e5", from: "server", to: "gpt", step: 5 },
    { id: "e6", from: "gpt", to: "user", step: 6 },
  ],
  steps: [
    { index: 1, caption: "User asks a question.", nodeIds: ["user", "server"], edgeIds: ["e1"] },
    { index: 2, caption: "Server queries search.", nodeIds: ["server", "search"], edgeIds: ["e2"] },
    { index: 3, caption: "Search hits the DB.", nodeIds: ["search", "db"], edgeIds: ["e3"] },
    { index: 4, caption: "Context returns.", nodeIds: ["db", "server"], edgeIds: ["e4"] },
    { index: 5, caption: "Server calls the LLM.", nodeIds: ["server", "gpt"], edgeIds: ["e5"] },
    { index: 6, caption: "Answer streams back.", nodeIds: ["gpt", "user"], edgeIds: ["e6"] },
  ],
};

describe("layoutSystemDiagram", () => {
  it("places a node's pixel origin from its grid cell", () => {
    const layout = layoutSystemDiagram(RAG_DIAGRAM);
    const server = layout.nodesById.get("server")!;
    expect(server.x).toBe(PAD + 1 * (CELL_W + GAP_X));
    expect(server.y).toBe(PAD + 1 * (CELL_H + GAP_Y));
    expect(server.w).toBe(CELL_W);
    expect(server.h).toBe(CELL_H);
  });

  it("widens a node by colSpan/rowSpan", () => {
    const layout = layoutSystemDiagram({
      columns: 3,
      rows: 2,
      nodes: [{ id: "wide", label: "Wide", col: 0, row: 0, colSpan: 2, rowSpan: 2 }],
      edges: [],
    });
    const n = layout.nodesById.get("wide")!;
    expect(n.w).toBe(2 * CELL_W + GAP_X);
    expect(n.h).toBe(2 * CELL_H + GAP_Y);
  });

  it("derives a group's bounding box from its members when no rect is given", () => {
    const layout = layoutSystemDiagram(RAG_DIAGRAM);
    const sources = layout.groups.find((g) => g.id === "sources")!;
    const pdf = layout.nodesById.get("pdf")!;
    const db = layout.nodesById.get("db")!;
    const minY = Math.min(pdf.y, db.y);
    const maxY = Math.max(pdf.y + pdf.h, db.y + db.h);
    expect(sources.x).toBeLessThan(Math.min(pdf.x, db.x));
    expect(sources.y).toBeLessThan(minY);
    expect(sources.y + sources.h).toBeGreaterThanOrEqual(maxY);
  });

  it("uses an explicit group rect verbatim when col/row/spans are all given", () => {
    const layout = layoutSystemDiagram({
      columns: 4,
      rows: 2,
      nodes: [{ id: "a", label: "A", col: 0, row: 0 }],
      edges: [],
      groups: [{ id: "g", label: "G", color: "blue", col: 2, row: 0, colSpan: 2, rowSpan: 2 }],
    });
    const g = layout.groups[0];
    const expected = { x: PAD + 2 * (CELL_W + GAP_X), y: PAD };
    expect(g.x).toBeLessThan(expected.x); // padded outward
    expect(g.w).toBeGreaterThan(2 * CELL_W); // padding widened it
  });

  it("grows canvas dimensions to fit a group that overhangs the base grid", () => {
    const layout = layoutSystemDiagram({
      columns: 1,
      rows: 1,
      nodes: [{ id: "a", label: "A", col: 0, row: 0 }],
      edges: [],
      groups: [{ id: "g", label: "G", color: "blue", col: 0, row: 0, colSpan: 3, rowSpan: 3 }],
    });
    expect(layout.width).toBeGreaterThan(PAD * 2 + CELL_W);
    expect(layout.height).toBeGreaterThan(PAD * 2 + CELL_H);
  });

  it("fans out parallel edges between the same pair", () => {
    const layout = layoutSystemDiagram({
      columns: 2,
      rows: 1,
      nodes: [
        { id: "a", label: "A", col: 0, row: 0 },
        { id: "b", label: "B", col: 1, row: 0 },
      ],
      edges: [
        { id: "e1", from: "a", to: "b" },
        { id: "e2", from: "a", to: "b" },
        { id: "e3", from: "b", to: "a" },
      ],
    });
    const [e1, e2, e3] = layout.edges;
    // All three share a pair, so none should land on an identical path.
    expect(e1.d).not.toBe(e2.d);
    expect(e2.d).not.toBe(e3.d);
    expect(e1.d).not.toBe(e3.d);
  });

  it("places a step edge's badge at its geometric midpoint", () => {
    const layout = layoutSystemDiagram(RAG_DIAGRAM);
    const edge = layout.edges.find((e) => e.id === "e1")!;
    expect(edge.badge).toBeDefined();
    const mid = pointAtLength(edge.points, edge.length / 2);
    expect(edge.badge!.x).toBeCloseTo(mid.x, 5);
    expect(edge.badge!.y).toBeCloseTo(mid.y, 5);
  });
});

describe("routeEdge — relative grid positions", () => {
  const box = (id: string, x: number, y: number) => ({ id, x, y, w: CELL_W, h: CELL_H, node: {} as never });

  it("same row, target to the right: straight horizontal, right→left ports", () => {
    const from = box("a", 0, 0);
    const to = box("b", 300, 0);
    const points = routeEdge(from, to, "auto");
    expect(points).toHaveLength(2);
    expect(points[0].x).toBe(from.x + from.w); // right port
    expect(points[1].x).toBe(to.x); // left port
    expect(points[0].y).toBe(points[1].y);
  });

  it("same row, target to the left: left→right ports", () => {
    const from = box("a", 300, 0);
    const to = box("b", 0, 0);
    const points = routeEdge(from, to, "auto");
    expect(points[0].x).toBe(from.x); // left port
    expect(points[1].x).toBe(to.x + to.w); // right port
  });

  it("same column, target below: straight vertical, bottom→top ports", () => {
    const from = box("a", 0, 0);
    const to = box("b", 0, 300);
    const points = routeEdge(from, to, "auto");
    expect(points[0].y).toBe(from.y + from.h);
    expect(points[1].y).toBe(to.y);
    expect(points[0].x).toBe(points[1].x);
  });

  it("same column, target above: top→bottom ports", () => {
    const from = box("a", 0, 300);
    const to = box("b", 0, 0);
    const points = routeEdge(from, to, "auto");
    expect(points[0].y).toBe(from.y);
    expect(points[1].y).toBe(to.y + to.h);
  });

  it("diagonal, auto/horizontal-first: one elbow at the target's centre-x", () => {
    const from = box("a", 0, 0);
    const to = box("b", 300, 300);
    const points = routeEdge(from, to, "auto");
    expect(points).toHaveLength(3);
    expect(points[1].x).toBe(to.x + to.w / 2); // turn at target centre-x
    expect(points[1].y).toBe(points[0].y); // exits horizontally first
  });

  it("diagonal, vertical-first: one elbow at the target's centre-y", () => {
    const from = box("a", 0, 0);
    const to = box("b", 300, 300);
    const points = routeEdge(from, to, "vertical-first");
    expect(points).toHaveLength(3);
    expect(points[1].y).toBe(to.y + to.h / 2);
    expect(points[1].x).toBe(points[0].x); // exits vertically first
  });

  it("straight: a single centre-to-centre segment clipped to both boxes", () => {
    const from = box("a", 0, 0);
    const to = box("b", 300, 300);
    const points = routeEdge(from, to, "straight");
    expect(points).toHaveLength(2);
    // Endpoints must lie on (or very near) each box's perimeter, not its centre.
    const onPerimeter = (p: { x: number; y: number }, r: typeof from) =>
      Math.abs(p.x - r.x) < 1 ||
      Math.abs(p.x - (r.x + r.w)) < 1 ||
      Math.abs(p.y - r.y) < 1 ||
      Math.abs(p.y - (r.y + r.h)) < 1;
    expect(onPerimeter(points[0], from)).toBe(true);
    expect(onPerimeter(points[1], to)).toBe(true);
  });

  it("self-edge: loops out and back to the same box", () => {
    const from = box("a", 0, 0);
    const points = routeEdge(from, from, "auto");
    expect(points.length).toBeGreaterThan(2);
    expect(points[0].x).not.toBe(points[points.length - 1].x);
  });
});

describe("pointsToPath / pathLength / pointAtLength", () => {
  it("builds a two-point path as a plain line", () => {
    const d = pointsToPath([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    expect(d).toBe("M 0 0 L 100 0");
  });

  it("computes length as the polyline's straight-segment sum", () => {
    const length = pathLength([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
    expect(length).toBeCloseTo(200, 5);
  });

  it("finds the midpoint across a multi-segment path", () => {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    const mid = pointAtLength(points, 100); // exactly the first corner
    expect(mid.x).toBeCloseTo(100, 5);
    expect(mid.y).toBeCloseTo(0, 5);
  });

  it("clamps to the endpoints outside [0, length]", () => {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    expect(pointAtLength(points, -10)).toEqual({ x: 0, y: 0 });
    expect(pointAtLength(points, 1000)).toEqual({ x: 100, y: 0 });
  });
});

describe("validateSystemDiagram", () => {
  it("accepts the RAG reference diagram with no problems", () => {
    expect(validateSystemDiagram(RAG_DIAGRAM)).toEqual([]);
  });

  it("flags a duplicate node id", () => {
    const problems = validateSystemDiagram({
      columns: 2, rows: 1,
      nodes: [{ id: "a", label: "A", col: 0, row: 0 }, { id: "a", label: "A2", col: 1, row: 0 }],
      edges: [],
    });
    expect(problems.some((p) => p.includes('duplicate node id "a"'))).toBe(true);
  });

  it("flags an edge to an unknown node", () => {
    const problems = validateSystemDiagram({
      columns: 2, rows: 1,
      nodes: [{ id: "a", label: "A", col: 0, row: 0 }],
      edges: [{ id: "e1", from: "a", to: "ghost" }],
    });
    expect(problems.some((p) => p.includes('unknown target node "ghost"'))).toBe(true);
  });

  it("flags a node's reference to an unknown group", () => {
    const problems = validateSystemDiagram({
      columns: 2, rows: 1,
      nodes: [{ id: "a", label: "A", col: 0, row: 0, groupId: "ghost" }],
      edges: [],
    });
    expect(problems.some((p) => p.includes('unknown group "ghost"'))).toBe(true);
  });

  it("flags a node placed outside the declared grid", () => {
    const problems = validateSystemDiagram({
      columns: 2, rows: 2,
      nodes: [{ id: "a", label: "A", col: 5, row: 0 }],
      edges: [],
    });
    expect(problems.some((p) => p.includes("outside the 2x2 grid"))).toBe(true);
  });

  it("flags two nodes overlapping the same cell", () => {
    const problems = validateSystemDiagram({
      columns: 2, rows: 2,
      nodes: [
        { id: "a", label: "A", col: 0, row: 0 },
        { id: "b", label: "B", col: 0, row: 0 },
      ],
      edges: [],
    });
    expect(problems.some((p) => p.includes("overlap at cell (0, 0)"))).toBe(true);
  });

  it("flags a step referencing an unknown node or edge", () => {
    const problems = validateSystemDiagram({
      columns: 2, rows: 1,
      nodes: [{ id: "a", label: "A", col: 0, row: 0 }, { id: "b", label: "B", col: 1, row: 0 }],
      edges: [{ id: "e1", from: "a", to: "b" }],
      steps: [{ index: 1, caption: "go", nodeIds: ["ghost"], edgeIds: ["e1"] }],
    });
    expect(problems.some((p) => p.includes('unknown node "ghost"'))).toBe(true);
  });

  it("flags a non-contiguous step sequence", () => {
    const problems = validateSystemDiagram({
      columns: 2, rows: 1,
      nodes: [{ id: "a", label: "A", col: 0, row: 0 }],
      edges: [],
      steps: [
        { index: 1, caption: "one", nodeIds: [], edgeIds: [] },
        { index: 3, caption: "three", nodeIds: [], edgeIds: [] },
      ],
    });
    expect(problems.some((p) => p.includes("contiguous 1..N sequence"))).toBe(true);
  });

  it("flags a grid larger than 8x8", () => {
    const problems = validateSystemDiagram({ columns: 9, rows: 9, nodes: [], edges: [] });
    expect(problems.some((p) => p.includes("keep it to 8 columns"))).toBe(true);
  });
});
