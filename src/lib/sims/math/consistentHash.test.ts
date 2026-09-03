import { describe, expect, it } from "vitest";

import {
  modRemappedFraction,
  remappedFraction,
  simulateConsistentHashing,
} from "./consistentHash";

describe("simulateConsistentHashing", () => {
  it("distributes key share across every node with no owner missing", () => {
    const out = simulateConsistentHashing({
      nodeIds: ["a", "b", "c", "d"],
      virtualNodesPerNode: 50,
      keyCount: 4000,
    });
    expect(Object.keys(out.keyShare).sort()).toEqual(["a", "b", "c", "d"]);
    const total = Object.values(out.keyShare).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it("more virtual nodes per node reduces share variance", () => {
    const few = simulateConsistentHashing({ nodeIds: ["a", "b", "c", "d", "e"], virtualNodesPerNode: 1, keyCount: 5000 });
    const many = simulateConsistentHashing({ nodeIds: ["a", "b", "c", "d", "e"], virtualNodesPerNode: 100, keyCount: 5000 });
    expect(many.shareStdDev).toBeLessThan(few.shareStdDev);
  });
});

describe("remappedFraction — the ring's core property", () => {
  it("remaps roughly 1/N of keys when adding one node to N", () => {
    const before = ["a", "b", "c", "d"];
    const after = [...before, "e"];
    const fraction = remappedFraction(before, after, 100, 5000);
    // Ideal is 1/5 = 0.2; allow generous slack for virtual-node hashing variance.
    expect(fraction).toBeGreaterThan(0.05);
    expect(fraction).toBeLessThan(0.4);
  });

  it("remaps far fewer keys than naive modulo hashing for the same topology change", () => {
    const before = ["a", "b", "c", "d"];
    const after = [...before, "e"];
    const ringFraction = remappedFraction(before, after, 100, 5000);
    const modFraction = modRemappedFraction(4, 5, 5000);
    expect(ringFraction).toBeLessThan(modFraction);
  });

  it("remaps nothing when the node set is unchanged", () => {
    const nodes = ["a", "b", "c"];
    expect(remappedFraction(nodes, nodes, 50, 2000)).toBe(0);
  });
});

describe("modRemappedFraction", () => {
  it("remaps nearly all keys when N changes for naive modulo hashing", () => {
    const fraction = modRemappedFraction(4, 5, 5000);
    expect(fraction).toBeGreaterThan(0.6);
  });
});
