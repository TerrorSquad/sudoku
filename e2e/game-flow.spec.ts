import { test, expect } from "@playwright/test";

const BOARD = ".grid.aspect-square.w-full.grid-cols-9";
// A valid solved grid with one cell (row-index 5, col-index 4) blanked out.
const ALMOST_SOLVED =
  "534678912672195348198342567859761423426853791713904856961537284287419635345286179";

test("starts a new game and renders a full board", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Beginner/ }).click();
  await expect(page.locator(`${BOARD} > div`)).toHaveCount(81);
});

test("filling the last correct digit wins the puzzle", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Custom Puzzle" }).click();
  await page.locator("textarea").fill(ALMOST_SOLVED);
  await page.getByRole("button", { name: "Play Puzzle" }).click();

  await page.locator(`${BOARD} > div`).nth(49).click();
  const numpad = page.locator(".grid-cols-5").nth(1);
  await numpad.locator("button:not([disabled])").first().click();

  await expect(page.getByRole("heading", { name: "Puzzle Solved!" })).toBeVisible();
});
