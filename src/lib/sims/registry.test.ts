import { describe, expect, it } from "vitest";

import { SIMULATOR_IDS } from "@/lib/sims/ids";
import { SIMULATOR_REGISTRY } from "@/lib/sims/registry";

/**
 * Guards the gap that shipped two courses with a dead simulator: content
 * validation checked that an authored `simulatorId` existed in the enum and
 * the registry, but nothing checked that anything could actually *render* it.
 *
 * Renderer coverage itself is now enforced at compile time —
 * `SIMULATOR_COMPONENTS` in SimulatorWidget.tsx is typed
 * `Record<SimulatorId, SimComponent>`, so a missing renderer fails
 * `tsc --noEmit` (which CI runs) rather than silently rendering the
 * "isn't available yet" card. These tests cover what the type can't: that
 * the registry metadata backing each simulator is actually usable.
 */
describe("simulator registry", () => {
  it("has metadata for every simulator id", () => {
    for (const id of SIMULATOR_IDS) {
      const spec = SIMULATOR_REGISTRY[id];
      expect(spec, `no registry entry for "${id}"`).toBeDefined();
      expect(spec.id).toBe(id);
      expect(spec.title).toBeTruthy();
      expect(spec.summary).toBeTruthy();
      expect(spec.params.length).toBeGreaterThan(0);
    }
  });

  it("registers no metadata for an id outside the enum", () => {
    expect(Object.keys(SIMULATOR_REGISTRY).sort()).toEqual([...SIMULATOR_IDS].sort());
  });

  it("gives every param a unique key within its simulator", () => {
    for (const id of SIMULATOR_IDS) {
      const keys = SIMULATOR_REGISTRY[id].params.map((p) => p.key);
      expect(new Set(keys).size, `duplicate param key in "${id}"`).toBe(keys.length);
    }
  });

  it("gives every numeric param a default inside its own declared range", () => {
    for (const id of SIMULATOR_IDS) {
      for (const param of SIMULATOR_REGISTRY[id].params) {
        if (typeof param.default !== "number") continue;
        if (param.min !== undefined) {
          expect(param.default, `${id}.${param.key} default below min`).toBeGreaterThanOrEqual(param.min);
        }
        if (param.max !== undefined) {
          expect(param.default, `${id}.${param.key} default above max`).toBeLessThanOrEqual(param.max);
        }
      }
    }
  });

  it("gives every choice param at least two options", () => {
    for (const id of SIMULATOR_IDS) {
      for (const param of SIMULATOR_REGISTRY[id].params) {
        if (param.kind !== "choice") continue;
        expect(param.choices?.length ?? 0, `${id}.${param.key} has too few choices`).toBeGreaterThan(1);
      }
    }
  });
});
