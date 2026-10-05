import { defineConfig, devices } from "@playwright/test";

// Deterministic rasterization across machines.
const launchOptions = {
  args: [
    "--disable-lcd-text",
    "--disable-font-subpixel-positioning",
    "--font-render-hinting=none",
    "--force-color-profile=srgb",
    "--disable-gpu",
    "--force-device-scale-factor=1",
  ],
};

const visual = {
  testMatch: /visual\.spec\.ts/,
  snapshotPathTemplate: "e2e/visual-regression-snapshots/{projectName}/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      // Absolute cap: absorbs font hinting/AA drift, not a missing element.
      maxDiffPixels: 300,
      animations: "disabled" as const,
      caret: "hide" as const,
      scale: "css" as const,
    },
  },
};

export default defineConfig({
  testDir: "./e2e",
  // A single dev-mode Nuxt server backs every test; parallel workers contend
  // for it and cause flaky timeouts, so run serially instead.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3010",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /visual\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    // Pixel baselines; opt-in so a plain `pnpm test:e2e` never fails on rasterization noise.
    // Same spec, two form factors: 1080p desktop and Pixel 7.
    ...(process.env.VISUAL_REGRESSION
      ? [
          {
            name: "visual",
            ...visual,
            use: {
              ...devices["Desktop Chrome"],
              viewport: { width: 1920, height: 1080 },
              // Entrance animations jump to their end state, so captures are deterministic.
              reducedMotion: "reduce" as const,
              launchOptions,
            },
          },
          {
            name: "visual-mobile",
            ...visual,
            use: { ...devices["Pixel 7"], reducedMotion: "reduce" as const, launchOptions },
          },
        ]
      : []),
  ],
  webServer: {
    command: "pnpm dev --port 3010",
    url: "http://localhost:3010",
    // A reused server ignores the env block below, so never reuse for visual runs.
    reuseExistingServer: !process.env.CI && !process.env.VISUAL_REGRESSION,
    timeout: 60_000,
    // Nuxt's single-instance dev lock is keyed by project dir, not port — bypass it
    // so the e2e server can run alongside another dev server on a different port.
    env: { NUXT_IGNORE_LOCK: "1" },
  },
});
