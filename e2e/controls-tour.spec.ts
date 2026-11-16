/* oxlint-disable eslint/no-await-in-loop -- tour steps are inherently sequential */
import { test, expect, type Page } from "@playwright/test";

import { BOARD, unlockAllLevels } from "./seed";

const tour = (page: Page) => page.locator(".driver-popover");

async function newBeginner(page: Page) {
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Beginner/ }).click();
  await expect(page.locator(`${BOARD} [data-cell]`)).toHaveCount(81);
}

test.describe("a new player", () => {
  // A fresh profile: the config seeds every other spec with the tour already seen.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("sees the tour once, on the first game", async ({ page }) => {
    await page.goto("/");
    await newBeginner(page);
    await expect(tour(page)).toContainText("Placing digits");
    await expect(tour(page)).toContainText("1 of 5");
    // The first tour holds the clock, without the pause overlay over the controls.
    const clock = page.getByTestId("timer");
    const held = await clock.textContent();
    await page.waitForTimeout(2200);
    await expect(clock).toHaveText(held!);
    await expect(page.getByText("Paused")).toBeHidden();
    // The tour has the keys: a digit doesn't reach the board behind it.
    await page.keyboard.press("n");
    await expect(page.locator('[data-tour="notes"]')).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Shift+Z");
    await expect(page.getByRole("dialog", { name: "Move history" })).toBeHidden();
    for (const title of ["Notes", "Hints", "Undo", "Pause and menu"]) {
      await page.getByRole("button", { name: "Next" }).click();
      await expect(tour(page)).toContainText(title);
    }
    await page.getByRole("button", { name: "Got it" }).click();
    await expect(tour(page)).toBeHidden();
    await expect(clock).not.toHaveText(held!, { timeout: 3000 });

    await page.getByRole("button", { name: "Exit" }).click();
    await page.reload();
    await page.getByRole("button", { name: "New Game" }).click();
    await page.getByRole("button", { name: /Easy/ }).click();
    await expect(page.locator(`${BOARD} [data-cell]`)).toHaveCount(81);
    await page.waitForTimeout(500);
    await expect(tour(page)).toBeHidden();
  });

  test("Esc skips it for good", async ({ page }) => {
    await page.goto("/");
    await newBeginner(page);
    await expect(tour(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tour(page)).toBeHidden();
    // The game's keys are back.
    await page.keyboard.press("n");
    await expect(page.locator('[data-tour="notes"]')).toHaveAttribute("aria-pressed", "true");

    await page.reload();
    await page.getByRole("button", { name: "New Game" }).click();
    await page.getByRole("button", { name: /Easy/ }).click();
    await expect(page.locator(`${BOARD} [data-cell]`)).toHaveCount(81);
    await page.waitForTimeout(500);
    await expect(tour(page)).toBeHidden();
  });
});

test("a player who has won before never gets it after an upgrade", async ({ page }) => {
  await unlockAllLevels(page); // two Master wins, and no tour pref stored
  await page.goto("/");
  await newBeginner(page);
  await page.waitForTimeout(500);
  await expect(tour(page)).toBeHidden();
});

test.describe("a tour that can't load", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("leaves the game's keys working", async ({ page }) => {
    await page.route(/ControlsTour/, (route) => route.abort());
    await page.goto("/");
    await newBeginner(page);
    await page.waitForTimeout(1000);
    await expect(tour(page)).toBeHidden();
    await page.keyboard.press("n");
    await expect(page.locator('[data-tour="notes"]')).toHaveAttribute("aria-pressed", "true");
  });
});

test("Settings queues it for the next game", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Show tour" }).click();
  await expect(page.getByText("Plays at the start of your next game.")).toBeVisible();
  await page.getByRole("button", { name: "Menu" }).click();
  await newBeginner(page);
  await expect(tour(page)).toContainText("Placing digits");
});

test("the ? sheet replays it over the game", async ({ page }) => {
  await page.goto("/");
  await newBeginner(page);
  await page.waitForTimeout(500);
  await expect(tour(page)).toBeHidden();
  await page.keyboard.press("?");
  await page.getByRole("button", { name: "Show the controls tour" }).click();
  await expect(tour(page)).toContainText("Placing digits");
  await expect(page.getByRole("button", { name: "Next" })).toBeFocused();
});
