import { describe, expect, it } from "vitest";

import { doubtLibrary } from "./doubtLibrary";
import { doubtCore } from "./doubtSpec";
import { checkOpenUi } from "./validate";

/**
 * The server prompts and validates with doubtCore; the browser renders with
 * doubtLibrary. If they ever disagreed, the model would be told one contract
 * and the renderer would expect another.
 */
describe("doubt library contract", () => {
  it("gives the model the same prompt from both libraries", () => {
    expect(doubtLibrary.prompt({ preamble: "p" })).toBe(doubtCore.prompt({ preamble: "p" }));
  });

  it("validates against the same schema from both libraries", () => {
    expect(doubtLibrary.toJSONSchema()).toEqual(doubtCore.toJSONSchema());
  });

  it("validates a real answer with the server library", () => {
    const answer = ['root = Answer("Why n", [p, t])', 'p = Paragraph("Because we count n values.", "So divide by n.")', 't = TimeChip(216, "where it is defined")'].join("\n");
    expect(checkOpenUi(answer, doubtCore)).toEqual({ ok: true, problems: [] });
  });
});
