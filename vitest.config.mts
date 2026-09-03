import { defineConfig } from "vitest/config";

/**
 * Unit tests for the pure layers — A2UI catalog/validation, diagram geometry,
 * simulator math, grading, and authored content. Node environment only: there
 * are deliberately no component tests, since the leverage is all in the modules
 * that hold logic rather than markup.
 *
 * `resolve.tsconfigPaths` handles the `@/*` alias natively, so no plugin.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
