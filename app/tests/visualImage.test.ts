import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Visual baselines are only comparable when rendered by the same Playwright build: the Docker
// image behind `pnpm visual` and the CI job must match the installed @playwright/test.
describe("visual regression image", () => {
  const installed = JSON.parse(
    readFileSync("node_modules/@playwright/test/package.json", "utf8"),
  ).version;
  const image = `mcr.microsoft.com/playwright:v${installed}-noble`;

  it.each(["package.json", ".github/workflows/visual.yml", ".github/workflows/check.yml"])(
    "%s uses the installed version",
    (file) => {
      const tags = readFileSync(file, "utf8").match(/mcr\.microsoft\.com\/playwright:v[\w.-]+/g);
      expect(tags).toEqual([image]);
    },
  );
});
