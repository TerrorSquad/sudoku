import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // e2e/ holds Playwright Test specs (run via `pnpm test:e2e`), not vitest's.
    exclude: ["node_modules/**", "e2e/**"],
  },
});
