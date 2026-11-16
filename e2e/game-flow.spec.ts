import { test, expect } from "@playwright/test";

import { BOARD, blank, openDaily, playCustom } from "./seed";

// A valid solved grid with one cell (row-index 5, col-index 4) blanked out.
const ALMOST_SOLVED = blank(49);

test("starts a new game and renders a full board", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Beginner/ }).click();
  await expect(page.locator(`${BOARD} [data-cell]`)).toHaveCount(81);
});

test("filling the last correct digit wins the puzzle", async ({ page }) => {
  await page.goto("/");
  await playCustom(page, ALMOST_SOLVED);

  await page.locator(`${BOARD} [data-cell]`).nth(49).click();
  const numpad = page.getByTestId("numpad");
  await numpad.locator("button:not([disabled])").first().click();

  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeVisible();
});

test("leaving the Daily doesn't carry it into the next game", async ({ page }) => {
  await page.goto("/");
  await openDaily(page);
  await expect(page.getByText("Daily", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Exit" }).click();
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Beginner/ }).click();
  await expect(page.getByText("Beginner", { exact: true })).toBeVisible();
  await expect(page.getByText("Daily", { exact: true })).toBeHidden();
});
