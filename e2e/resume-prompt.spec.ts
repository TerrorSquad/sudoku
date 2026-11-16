import { test, expect, type Page } from "@playwright/test";

import { BOARD } from "./seed";

// Starting a game autosaves immediately, so exiting right back to the
// difficulty screen for the same level is enough to trigger the prompt.
async function createSaveAndReturnToDifficulty(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Easy/ }).click();
  await expect(page.locator(`${BOARD} [data-cell]`)).toHaveCount(81);
  await page.getByLabel("Exit").click();
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Easy/ }).click();
}

test("prompts to resume when a save exists for the chosen difficulty", async ({ page }) => {
  await createSaveAndReturnToDifficulty(page);
  await expect(page.getByRole("heading", { name: "Saved game found" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start a new game" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
});

test("cancel dismisses the prompt without leaving the difficulty screen", async ({ page }) => {
  await createSaveAndReturnToDifficulty(page);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "Saved game found" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Choose a difficulty" })).toBeVisible();
});

test("continue resumes into the game screen", async ({ page }) => {
  await createSaveAndReturnToDifficulty(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(`${BOARD} [data-cell]`)).toHaveCount(81);
});

test("start new dismisses the prompt and starts a fresh game", async ({ page }) => {
  await createSaveAndReturnToDifficulty(page);
  await page.getByRole("button", { name: "Start a new game" }).click();
  await expect(page.locator(`${BOARD} [data-cell]`)).toHaveCount(81);
});

const saveKeys = (page: Page) =>
  page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("sudoku_v1_save_")));

async function playDailyAndExit(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Daily puzzle" }).click();
  await expect(page.locator(`${BOARD} [data-cell]`)).toHaveCount(81);
  await page.getByLabel("Exit").click();
}

test("the Daily saves to its own slot and resumes as the Daily", async ({ page }) => {
  await playDailyAndExit(page);
  expect(await saveKeys(page)).toEqual(["sudoku_v1_save_daily"]); // not the medium slot

  await page.getByRole("button", { name: "Daily puzzle" }).click();
  await expect(page.getByRole("heading", { name: "Saved game found" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Daily", { exact: true })).toBeVisible();
});

test("a Daily saved on an earlier day isn't offered", async ({ page }) => {
  await playDailyAndExit(page);
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem("sudoku_v1_save_daily")!);
    localStorage.setItem("sudoku_v1_save_daily", JSON.stringify({ ...save, daily: "2000-01-01" }));
  });

  await page.getByRole("button", { name: "Daily puzzle" }).click();
  await expect(page.locator(`${BOARD} [data-cell]`)).toHaveCount(81);
  await expect(page.getByRole("heading", { name: "Saved game found" })).toBeHidden();
  const save = await page.evaluate(() => localStorage.getItem("sudoku_v1_save_daily"));
  expect(JSON.parse(save!).daily).not.toBe("2000-01-01");
});
