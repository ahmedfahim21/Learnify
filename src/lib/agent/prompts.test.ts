import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ComponentSchema, type SystemDiagramProps } from "../a2ui/catalog";
import { validateSystemDiagram } from "../a2ui/diagram";
import { renderLearnerSnapshot, TUTOR_SYSTEM_PROMPT } from "./prompts";
import { presentUiInputSchema } from "./tools";

describe("TUTOR_SYSTEM_PROMPT byte-stability", () => {
  it("contains no template interpolation", () => {
    // A literal `${` would mean per-request data leaked into the cached
    // system prompt, breaking prompt caching across sessions.
    expect(TUTOR_SYSTEM_PROMPT).not.toContain("${");
  });

  it("is a non-empty plain string, not a function of runtime state", () => {
    expect(typeof TUTOR_SYSTEM_PROMPT).toBe("string");
    expect(TUTOR_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });
});

describe("the embedded SystemDiagram few-shot", () => {
  const match = TUTOR_SYSTEM_PROMPT.match(/```json\n([\s\S]*?)\n```/);

  it("is present in the prompt", () => {
    expect(match).not.toBeNull();
  });

  it("parses as JSON and validates against present_ui's schema", () => {
    const json = JSON.parse(match![1]);
    const parsed = presentUiInputSchema.safeParse(json);
    expect(parsed.success, parsed.success ? "" : JSON.stringify(z.treeifyError(parsed.error))).toBe(true);
  });

  it("its SystemDiagram component has no referential-integrity problems", () => {
    const json = JSON.parse(match![1]);
    const diagram = json.components.find((c: { component: string }) => c.component === "SystemDiagram");
    expect(diagram).toBeDefined();
    const parsedProps = ComponentSchema.safeParse(diagram);
    expect(parsedProps.success).toBe(true);
    if (parsedProps.success && parsedProps.data.component === "SystemDiagram") {
      expect(validateSystemDiagram(parsedProps.data.properties as SystemDiagramProps)).toEqual([]);
    }
  });
});

describe("renderLearnerSnapshot", () => {
  it("lists authored assets by id, kind, title, and concept", () => {
    const rendered = renderLearnerSnapshot({
      topicTitle: "URL Shortener",
      authoredAssets: [
        { id: "url-shortener.write-path", kind: "diagram", conceptSlug: "high-level-design", title: "Write path" },
      ],
    });
    expect(rendered).toContain("present_authored");
    expect(rendered).toContain("url-shortener.write-path");
    expect(rendered).toContain("diagram");
    expect(rendered).toContain("Write path");
    expect(rendered).toContain("high-level-design");
  });

  it("lists design phases in order", () => {
    const rendered = renderLearnerSnapshot({
      topicTitle: "URL Shortener",
      designPhases: ["requirements", "estimation", "high-level"],
    });
    expect(rendered).toContain("requirements -> estimation -> high-level");
  });

  it("omits both sections when neither is provided", () => {
    const rendered = renderLearnerSnapshot({ topicTitle: "Anything" });
    expect(rendered).not.toContain("present_authored");
    expect(rendered).not.toContain("stages:");
  });
});
