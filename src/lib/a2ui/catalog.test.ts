import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ComponentSchema, WIDGET_KIND, WIDGET_NAMES, widgetProps } from "./catalog";
import { presentUiInputSchema } from "../agent/tools";

describe("catalog integrity", () => {
  it("registers a kind for every widget", () => {
    for (const name of WIDGET_NAMES) {
      expect(WIDGET_KIND[name], `${name} has no WIDGET_KIND entry`).toBeDefined();
    }
    expect(Object.keys(WIDGET_KIND).sort()).toEqual([...WIDGET_NAMES].sort());
  });

  it("derives WIDGET_NAMES from widgetProps", () => {
    expect(WIDGET_NAMES).toEqual(Object.keys(widgetProps));
  });

  it("requires children on containers and allows them off leaves", () => {
    const container = ComponentSchema.safeParse({
      id: "col",
      component: "Column",
      properties: {},
    });
    expect(container.success).toBe(false);

    const leaf = ComponentSchema.safeParse({
      id: "n1",
      component: "Narration",
      properties: { text: "hi" },
    });
    expect(leaf.success).toBe(true);
  });

  it("rejects an unknown component type", () => {
    const result = ComponentSchema.safeParse({
      id: "x",
      component: "ScriptTag",
      properties: { src: "https://evil.example/x.js" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a widget whose properties don't match its schema", () => {
    const result = ComponentSchema.safeParse({
      id: "mc1",
      component: "MultipleChoiceCheck",
      properties: { prompt: "Why?" }, // missing options + correctOptionId
    });
    expect(result.success).toBe(false);
  });
});

/**
 * `present_ui` is not a strict tool today, but the catalog is written to stay
 * strict-tool-safe so we can flip it on. These are the constraints strict tool
 * use rejects — this test is the guard that keeps the rule from being a comment
 * someone quietly breaks with a `.min(1)`.
 */
describe("present_ui JSON schema is strict-tool-safe", () => {
  const json = JSON.stringify(
    z.toJSONSchema(presentUiInputSchema, { target: "draft-2020-12" }),
  );

  it.each(["minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems", "pattern", "format"])(
    "contains no %s constraint",
    (keyword) => {
      expect(json).not.toContain(`"${keyword}"`);
    },
  );

  it("never sets additionalProperties to true", () => {
    expect(json).not.toContain('"additionalProperties":true');
  });
});
