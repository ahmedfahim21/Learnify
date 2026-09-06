import { describe, expect, it } from "vitest";

import {
  CELL_H,
  CELL_W,
  GAP_X,
  GAP_Y,
  PAD,
  handlePair,
  layoutSystemDiagram,
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
});

/** Edge routing itself is React Flow's `smoothstep`; what stays ours is
 *  choosing which side of each box an edge leaves from and arrives at, since
 *  that is what makes a diagram readable rather than a tangle. */
describe("handlePair", () => {
  const at = (col: number, row: number) => ({ id: `${col}-${row}`, label: "n", col, row });

  it("leaves right and arrives left when the target is along the same row", () => {
    expect(handlePair(at(0, 0), at(2, 0))).toEqual({ source: "right", target: "left" });
  });

  it("mirrors that when the target is to the left", () => {
    expect(handlePair(at(2, 0), at(0, 0))).toEqual({ source: "left", target: "right" });
  });

  it("leaves bottom and arrives top down a column", () => {
    expect(handlePair(at(1, 0), at(1, 2))).toEqual({ source: "bottom", target: "top" });
  });

  it("mirrors that going up a column", () => {
    expect(handlePair(at(1, 2), at(1, 0))).toEqual({ source: "top", target: "bottom" });
  });

  it("goes sideways first on a diagonal by default", () => {
    expect(handlePair(at(0, 0), at(2, 2))).toEqual({ source: "right", target: "top" });
  });

  it("goes vertically first when the edge asks for it", () => {
    expect(handlePair(at(0, 0), at(2, 2), "vertical-first")).toEqual({
      source: "bottom",
      target: "left",
    });
  });

  it("picks the near side when a diagonal runs up and to the left", () => {
    expect(handlePair(at(3, 3), at(1, 1))).toEqual({ source: "left", target: "bottom" });
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
