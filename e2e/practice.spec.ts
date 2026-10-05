import { test, expect } from "@playwright/test";

const BOARD = ".grid.aspect-square.w-full.grid-cols-9";

test("practising a technique starts a labelled game that doesn't touch progress", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sudoku Academy" }).click();
  // Swordfish practically never occurs in random puzzles, so this also exercises the drill fallback.
  const card = page
    .locator("h3", { hasText: "Swordfish" })
    .locator("xpath=ancestor::div[contains(@class,'cursor-pointer')]");
  await card.getByRole("button", { name: "Practice this technique" }).click();

  await expect(page.locator(`${BOARD} [data-cell]`)).toHaveCount(81, { timeout: 30_000 });
  await expect(page.getByText("Practice · Swordfish")).toBeVisible();

  // No autosave slot is created for practice games.
  const saved = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith("sudoku_v1_save_")),
  );
  expect(saved).toEqual([]);

  // Leaving returns to the menu with no score recorded.
  await page.getByLabel("Exit").click();
  await page.getByRole("button", { name: "Statistics" }).click();
  await expect(page.getByText("No games won yet")).toBeVisible();
});

test("a searchable technique yields a real puzzle", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sudoku Academy" }).click();
  const card = page
    .locator("h3", { hasText: "Pointing Pair" })
    .locator("xpath=ancestor::div[contains(@class,'cursor-pointer')]");
  await card.getByRole("button", { name: "Practice this technique" }).click();
  await expect(page.getByText("Practice · Pointing Pair")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(`${BOARD} [data-cell]`)).toHaveCount(81);
});
