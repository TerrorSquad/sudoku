import { defineConfig, devices } from "@playwright/test";

// `pnpm test:prod`: e2e/prod.spec.ts against the generated Wavedash build, served from a subfolder
// (scripts/serve-static.mjs) as Wavedash does. The dev server can't catch a broken production
// build: 1.10.0 shipped "Redirecting..." pages that only the ./ base under a subfolder showed.
const port = Number(process.env.PROD_PORT ?? 3120);

export default defineConfig({
  testDir: "./e2e",
  testMatch: /prod\.spec\.ts/,
  workers: 1,
  reporter: "list",
  use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${port}/game/` },
  webServer: {
    command: `node scripts/serve-static.mjs ${port}`,
    url: `http://localhost:${port}/game/`,
    reuseExistingServer: false,
  },
});
