/**
 * Concept-map layout: levels by prerequisite depth, top to bottom; within a
 * level, lecture order left to right.
 *
 * A concept's level is the length of its longest prerequisite chain, so every
 * arrow points downward and the map reads top to bottom the way the lecture
 * builds up. Vertical because the map lives in a narrow panel beside the
 * video: a left-to-right map shrank nodes until their text was unreadable.
 * Pure and deterministic — the same pack always draws the same map.
 */

export interface LayoutConcept {
  id: string;
  prereqIds: string[];
}

export interface Placed {
  id: string;
  /** Prerequisite depth: 0 for concepts that build on nothing here. */
  level: number;
  /** Position within the level, in lecture order. */
  order: number;
  x: number;
  y: number;
}

export const NODE_WIDTH = 170;
export const ORDER_GAP = 190;
export const LEVEL_GAP = 110;

export function layoutConcepts(concepts: LayoutConcept[]): Placed[] {
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const depth = new Map<string, number>();

  const depthOf = (id: string, visiting: Set<string>): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0; // Validator forbids cycles; don't recurse forever if one slips by.
    visiting.add(id);
    const prereqs = (byId.get(id)?.prereqIds ?? []).filter((p) => byId.has(p) && p !== id);
    const d = prereqs.length ? 1 + Math.max(...prereqs.map((p) => depthOf(p, visiting))) : 0;
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };

  const counts = new Map<number, number>();
  const placed = concepts.map((c) => {
    const level = depthOf(c.id, new Set());
    const order = counts.get(level) ?? 0;
    counts.set(level, order + 1);
    return { id: c.id, level, order, x: 0, y: level * LEVEL_GAP };
  });
  // Centre each level under the widest one, so the map reads as a tree.
  const widest = Math.max(...counts.values());
  for (const p of placed) {
    const offset = ((widest - (counts.get(p.level) ?? 1)) * ORDER_GAP) / 2;
    p.x = offset + p.order * ORDER_GAP;
  }
  return placed;
}
