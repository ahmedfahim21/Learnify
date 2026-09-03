import { describe, expect, it } from "vitest";

import { ComponentSchema, type SystemDiagramProps } from "@/lib/a2ui/catalog";
import { validateSystemDiagram } from "@/lib/a2ui/diagram";
import { SIMULATOR_IDS } from "@/lib/sims/ids";
import { SIMULATOR_REGISTRY } from "@/lib/sims/registry";

import { PROBLEMS } from "./index";
import { chainEdges, DESIGN_PHASES, flattenConcepts } from "./types";

describe("authored system design courses", () => {
  it("has a unique slug per problem", () => {
    const slugs = PROBLEMS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  for (const problem of PROBLEMS) {
    describe(problem.slug, () => {
      it("declares every chapter's phase exactly once, in DESIGN_PHASES order", () => {
        const phases = problem.chapters.map((c) => c.phase);
        expect(phases).toEqual(DESIGN_PHASES.slice(0, phases.length));
      });

      it("has at least one concept per chapter", () => {
        for (const chapter of problem.chapters) {
          expect(chapter.concepts.length).toBeGreaterThan(0);
        }
      });

      it("has globally unique concept slugs", () => {
        const slugs = flattenConcepts(problem).map((c) => c.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
      });

      it("produces a chain of edges referencing only known concept slugs", () => {
        const slugs = new Set(flattenConcepts(problem).map((c) => c.slug));
        const edges = chainEdges(problem);
        for (const edge of edges) {
          expect(slugs.has(edge.from)).toBe(true);
          expect(slugs.has(edge.to)).toBe(true);
        }
        // A chain over N concepts has exactly N-1 edges, and can't cycle.
        expect(edges.length).toBe(slugs.size - 1);
      });

      it("has at least one high-level or deep-dive diagram", () => {
        const hasDiagram = problem.chapters.some((c) =>
          c.blocks.some((b) => b.type === "diagram"),
        );
        expect(hasDiagram).toBe(true);
      });

      it("every embedded diagram passes the same validation the live tutor's diagrams do", () => {
        for (const chapter of problem.chapters) {
          for (const block of chapter.blocks) {
            if (block.type !== "diagram") continue;
            const parsed = ComponentSchema.safeParse({
              id: "content-check",
              component: "SystemDiagram",
              properties: block.diagram,
            });
            expect(parsed.success, `${problem.slug}/${chapter.phase}: ${
              parsed.success ? "" : JSON.stringify(parsed.error.issues)
            }`).toBe(true);
            if (parsed.success && parsed.data.component === "SystemDiagram") {
              expect(validateSystemDiagram(parsed.data.properties as SystemDiagramProps)).toEqual([]);
            }
          }
        }
      });

      it("gives every diagram node a detail, so clicking it reveals something", () => {
        // The schema keeps `detail` optional (the live tutor may omit it), but
        // authored content is the case where a node with nothing to say is a
        // dead click — the reader shows a detail panel for every node.
        for (const chapter of problem.chapters) {
          for (const block of chapter.blocks) {
            if (block.type !== "diagram") continue;
            for (const node of block.diagram.nodes) {
              expect(
                node.detail?.trim(),
                `${problem.slug}/${chapter.phase}: node "${node.id}" has no detail`,
              ).toBeTruthy();
            }
          }
        }
      });

      it("every embedded simulator references a real id and valid param keys", () => {
        for (const chapter of problem.chapters) {
          for (const block of chapter.blocks) {
            if (block.type !== "simulator") continue;
            expect(SIMULATOR_IDS as readonly string[]).toContain(block.simulatorId);
            const spec = SIMULATOR_REGISTRY[block.simulatorId];
            const validKeys = new Set(spec.params.map((p) => p.key));
            for (const param of block.params ?? []) {
              expect(validKeys.has(param.key), `${problem.slug}: unknown param "${param.key}" for ${block.simulatorId}`).toBe(true);
              // A value outside the spec's range is silently clamped at render,
              // which can land the simulator in a degenerate opening state
              // (e.g. a queue at 99.9% utilisation) that teaches the opposite
              // of the point the chapter is making.
              const paramSpec = spec.params.find((p) => p.key === param.key);
              if (!paramSpec || typeof param.value !== "number") continue;
              if (paramSpec.min !== undefined) {
                expect(
                  param.value,
                  `${problem.slug}: ${block.simulatorId}.${param.key}=${param.value} is below min ${paramSpec.min} and would be clamped`,
                ).toBeGreaterThanOrEqual(paramSpec.min);
              }
              if (paramSpec.max !== undefined) {
                expect(
                  param.value,
                  `${problem.slug}: ${block.simulatorId}.${param.key}=${param.value} is above max ${paramSpec.max} and would be clamped`,
                ).toBeLessThanOrEqual(paramSpec.max);
              }
            }
          }
        }
      });

      it("has functional and non-functional requirements", () => {
        expect(problem.functionalRequirements.length).toBeGreaterThan(0);
        expect(problem.nonFunctionalRequirements.length).toBeGreaterThan(0);
      });
    });
  }
});
