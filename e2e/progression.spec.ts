import { test, expect } from "@playwright/test";

import { BOARD, blank, grid, playCustom, resumeMedium, savedGame } from "./seed";

const ALMOST_SOLVED = blank(49);

test("a fast flawless first win crosses level 2 and the menu shows it", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("level-badge")).toContainText("Level 1");

  await playCustom(page, ALMOST_SOLVED);
  await page.locator(`${BOARD} [data-cell]`).nth(49).click();
  await page.getByTestId("numpad").locator("button:not([disabled])").first().click();

  await expect(page.getByText("Level up! You reached level 2")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("level-badge")).toContainText("Level 2");
});

test("a clean win shows three stars", async ({ page }) => {
  await page.goto("/");
  await playCustom(page, ALMOST_SOLVED);
  await page.locator(`${BOARD} [data-cell]`).nth(49).click();
  await page.getByTestId("numpad").locator("button:not([disabled])").first().click();
  await expect(page.getByRole("img", { name: "3 out of 3 stars" })).toBeVisible();
});

test("hints used before leaving a game still count after resuming it", async ({ page }) => {
  const puzzle = grid(blank(40));
  const save = savedGame({
    currentBoard: puzzle,
    initialBoard: puzzle,
    timerSeconds: 10,
    hintsUsed: 5,
  });
  await page.addInitScript((s) => {
    localStorage.setItem("sudoku_v1_save_medium", JSON.stringify(s));
  }, save);
  await resumeMedium(page);

  await page.locator(`${BOARD} [data-cell]`).nth(40).click();
  await page.getByTestId("numpad").locator("button:not([disabled])").first().click();

  await expect(page.getByRole("img", { name: "1 out of 3 stars" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Self-Reliant/ })).toHaveCount(0);
});
