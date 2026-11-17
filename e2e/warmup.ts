import { chromium, type FullConfig } from "@playwright/test";

// The webServer counts as ready once `/` answers, but with `ssr: false` that is only the shell:
// a cold dev server compiles the app on the first page load, and Vite then re-bundles the deps
// it found (canvas-confetti) and reloads the page. That outlasted the first test's 5 s expect,
// so load the menu once here, before any test runs.
export default async function warmup(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(config.projects[0]!.use.baseURL!);
  await page.getByRole("button", { name: "New Game" }).waitFor({ timeout: 60_000 });
  await browser.close();
}
