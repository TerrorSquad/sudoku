import { test, expect, type Page } from "@playwright/test";

import { BOARD, SOLVED, place, seedMediumSave, unlockAllLevels } from "./seed";

// Runs only under playwright.prod.config.ts (`pnpm test:prod`), against the generated build.
test("the production build loads and its main screens open", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await unlockAllLevels(page);
  // An existing player (the wins above) gets the tour only if asked: ask, to load its chunk.
  await page.addInitScript(() => localStorage.setItem("sudoku_v1_pref_controls_tour", "true"));
  // Relative to the /game/ base: the ./ assets must resolve under the subfolder.
  await page.goto("./");

  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Easy/ }).click();
  await expect(page.locator(`${BOARD} [data-cell]`)).toHaveCount(81);
  // The controls tour, a lazy chunk (driver.js and its CSS) that must load too.
  await expect(page.locator(".driver-popover.controls-tour")).toContainText("Placing digits");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Exit" }).click();

  await page.getByRole("button", { name: "Academy" }).click();
  const card = page.locator("#lesson-x-wing");
  await card.locator("h3").click();
  await expect(card.getByTestId("watch-example")).toBeVisible();
  await page.getByRole("button", { name: "Menu" }).first().click();

  await page.getByRole("button", { name: "Statistics" }).click();
  await expect(page.getByRole("heading", { name: "Your Statistics" })).toBeVisible();

  expect(errors).toEqual([]);
});

/**
 * 404s the next JS chunk a lazy screen imports, until the page reloads. Every request for it: a
 * failed modulepreload alone is silent, and the import fetches it again. Idle prefetches ("other")
 * pass.
 */
async function dropNextChunk(page: Page) {
  let url: string | undefined;
  let reloaded = false;
  page.once("load", () => (reloaded = true));
  await page.route("**/_nuxt/*.js", (route) => {
    const req = route.request();
    if (reloaded || req.resourceType() !== "script" || (url ??= req.url()) !== req.url())
      return route.continue();
    return route.fulfill({ status: 404 });
  });
}

// Nuxt's own chunk-error reload joined the ./ base to the route: /game/ became /game/game/, blank.
test("a lazy screen whose chunk fails reloads in place, under /game/", async ({ page }) => {
  await page.goto("./");
  await page.waitForLoadState("networkidle"); // the idle prefetches are done
  await dropNextChunk(page);
  const reloaded = page.waitForEvent("load");
  await page.getByRole("button", { name: "Statistics" }).click();
  await reloaded;
  expect(new URL(page.url()).pathname).toBe("/game/");
  await page.getByRole("button", { name: "Statistics" }).click();
  await expect(page.getByRole("heading", { name: "Your Statistics" })).toBeVisible();
});

test("a win whose modal chunk fails is still recorded after the reload", async ({ page }) => {
  await seedMediumSave(page, [40]);
  await page.goto("./");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Medium/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(`${BOARD} [data-cell]`)).toHaveCount(81);
  await dropNextChunk(page);
  const reloaded = page.waitForEvent("load");
  await place(page, 40, SOLVED[40]!);
  await reloaded;
  expect(new URL(page.url()).pathname).toBe("/game/");
  const stored = await page.evaluate(() => ({
    score: JSON.parse(localStorage.getItem("sudoku_v1_score") ?? "null"),
    save: localStorage.getItem("sudoku_v1_save_medium"),
  }));
  expect(stored.score).toMatchObject({ gamesWon: 1 });
  expect(stored.save).toBeNull(); // no solved board waiting to be resumed
  await expect(page.getByRole("button", { name: "New Game" })).toBeVisible();
});

// Nuxt's router wrote the ./ base joined to the path on start, /game/ → /game/game/: any reload
// (F5, a backup import) then loaded a blank page. plugins/keep-path.client.ts puts it back.
test("the address stays /game/, so a reload and a backup import land on the app", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByRole("button", { name: "New Game" })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/game/");

  await page.reload();
  await expect(page.getByRole("button", { name: "New Game" })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/game/");

  // Settings → Your data: importing a backup reloads the page.
  await page.evaluate(() =>
    localStorage.setItem(
      "sudoku_v1_score",
      JSON.stringify({ total: 4242, gamesWon: 7, best: {}, perDifficulty: {} }),
    ),
  );
  await page.getByRole("button", { name: "Settings" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export", exact: true }).click(),
  ]);
  await page.evaluate(() => localStorage.removeItem("sudoku_v1_score"));
  await page.getByTestId("import-file").setInputFiles((await download.path())!);
  const reloaded = page.waitForEvent("load");
  await page.getByRole("button", { name: "Replace", exact: true }).click();
  await reloaded;
  expect(new URL(page.url()).pathname).toBe("/game/");
  await expect(page.getByTestId("level-badge")).toContainText("Level 4");
});
