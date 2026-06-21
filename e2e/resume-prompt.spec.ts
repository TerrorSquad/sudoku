import { test, expect, type Page } from "@playwright/test";

const BOARD = ".grid.aspect-square.w-full.grid-cols-9";

// Starting a game autosaves immediately, so exiting right back to the
// difficulty screen for the same level is enough to trigger the prompt.
async function createSaveAndReturnToDifficulty(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Easy/ }).click();
  await expect(page.locator(`${BOARD} > div`)).toHaveCount(81);
  await page.getByLabel("Exit").click();
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Easy/ }).click();
}

test("prompts to resume when a save exists for the chosen difficulty", async ({ page }) => {
  await createSaveAndReturnToDifficulty(page);
  await expect(page.getByRole("heading", { name: "Saved game found" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start New" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
});

test("cancel dismisses the prompt without leaving the difficulty screen", async ({ page }) => {
  await createSaveAndReturnToDifficulty(page);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "Saved game found" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Choose a Challenge" })).toBeVisible();
});

test("continue resumes into the game screen", async ({ page }) => {
  await createSaveAndReturnToDifficulty(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(`${BOARD} > div`)).toHaveCount(81);
});

test("start new dismisses the prompt and starts a fresh game", async ({ page }) => {
  await createSaveAndReturnToDifficulty(page);
  await page.getByRole("button", { name: "Start New" }).click();
  await expect(page.locator(`${BOARD} > div`)).toHaveCount(81);
});
