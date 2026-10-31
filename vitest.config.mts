import { defineConfig } from "vitest/config";

/**
 * Unit tests for the pure layers — NPTEL decoding, caption parsing, Sarvam
 * client and translation alignment, study-pack validation — and for API routes
 * with their dependencies mocked. Node environment only: there are
 * deliberately no component tests, since the leverage is all in the modules
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
