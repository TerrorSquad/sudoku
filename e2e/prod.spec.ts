import { test, expect } from "@playwright/test";

import { BOARD, unlockAllLevels } from "./seed";

// Runs only under playwright.prod.config.ts (`pnpm test:prod`), against the generated build.
test("the production build loads and its main screens open", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await unlockAllLevels(page);
  // Relative to the /game/ base: the ./ assets must resolve under the subfolder.
  await page.goto("./");

  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Easy/ }).click();
  await expect(page.locator(`${BOARD} [data-cell]`)).toHaveCount(81);
  // A first game: the controls tour, a lazy chunk (driver.js and its CSS) that must load too.
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
