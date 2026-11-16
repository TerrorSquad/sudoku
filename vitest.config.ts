import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests only: e2e/ holds Playwright specs, and .claude/worktrees/ holds other checkouts.
    include: ["app/tests/**/*.test.ts"],
  },
});
