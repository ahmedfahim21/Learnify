import { describe, expect, it } from "vitest";

import { resolveParams, type SimulatorSpec } from "./types";

const spec: SimulatorSpec = {
  id: "cache-hit-ratio",
  title: "Test",
  summary: "",
  params: [
    { key: "hitRatio", label: "Hit ratio", kind: "percent", min: 0, max: 1, default: 0.8 },
    { key: "qps", label: "Traffic", kind: "number", min: 10, max: 100, default: 50 },
    { key: "enabled", label: "On", kind: "toggle", default: true },
  ],
};

describe("resolveParams", () => {
  it("uses the provided value when within range", () => {
    const resolved = resolveParams(spec, [{ key: "hitRatio", value: 0.5 }]);
    expect(resolved.hitRatio).toBe(0.5);
  });

  it("fills missing keys from the default", () => {
    const resolved = resolveParams(spec, []);
    expect(resolved).toEqual({ hitRatio: 0.8, qps: 50, enabled: true });
  });

  it("handles an undefined params array the same as empty", () => {
    expect(resolveParams(spec, undefined)).toEqual({ hitRatio: 0.8, qps: 50, enabled: true });
  });

  it("clamps a value above max", () => {
    const resolved = resolveParams(spec, [{ key: "qps", value: 9999 }]);
    expect(resolved.qps).toBe(100);
  });

  it("clamps a value below min", () => {
    const resolved = resolveParams(spec, [{ key: "qps", value: -5 }]);
    expect(resolved.qps).toBe(10);
  });

  it("drops unknown keys silently", () => {
    const resolved = resolveParams(spec, [{ key: "ghost", value: 1 }]);
    expect(resolved).not.toHaveProperty("ghost");
    expect(resolved.hitRatio).toBe(0.8); // untouched, still defaulted
  });

  it("falls back to the default when a numeric param is given a boolean", () => {
    const resolved = resolveParams(spec, [{ key: "qps", value: true }]);
    expect(resolved.qps).toBe(50);
  });

  it("falls back to the default when a toggle is given a number", () => {
    const resolved = resolveParams(spec, [{ key: "enabled", value: 1 }]);
    expect(resolved.enabled).toBe(true);
  });

  it("respects an explicit false for a toggle rather than defaulting", () => {
    const resolved = resolveParams(spec, [{ key: "enabled", value: false }]);
    expect(resolved.enabled).toBe(false);
  });
});
