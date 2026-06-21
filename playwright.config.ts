import { defineConfig, devices } from "@playwright/test";

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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev --port 3010",
    url: "http://localhost:3010",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // Nuxt's single-instance dev lock is keyed by project dir, not port — bypass it
    // so the e2e server can run alongside another dev server on a different port.
    env: { NUXT_IGNORE_LOCK: "1" },
  },
});
