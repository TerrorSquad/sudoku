import { test, expect } from "@playwright/test";

const BOARD = ".grid.aspect-square.w-full.grid-cols-9";
const ALMOST_SOLVED =
  "534678912672195348198342567859761423426853791713904856961537284287419635345286179";

async function winCustomPuzzle(page: import("@playwright/test").Page) {
  // Night Owl keys off the real hour; pin the clock so the unlock count is deterministic.
  await page.clock.setFixedTime(new Date("2026-01-15T12:00:00"));
  await page.goto("/");
  await page.getByRole("button", { name: "Custom Puzzle" }).click();
  await page.locator("textarea").fill(ALMOST_SOLVED);
  await page.getByRole("button", { name: "Play Puzzle" }).click();
  await page.locator(`${BOARD} [data-cell]`).nth(49).click();
  await page.getByTestId("numpad").locator("button:not([disabled])").first().click();
  await expect(page.getByRole("heading", { name: "Puzzle Solved!" })).toBeVisible();
}

test("winning pops an unlock toast and the trophy case records it", async ({ page }) => {
  await winCustomPuzzle(page);
  const toast = page.getByRole("button", { name: /Achievement unlocked.*First Win/s });
  await expect(toast).toBeVisible();
  // Clicking a toast dismisses it.
  await toast.click();
  await expect(toast).toBeHidden();

  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Achievements" }).click();
  await expect(page.getByText("3 of 19 unlocked")).toBeVisible();
  await expect(page.locator('[data-unlocked="true"]')).toHaveCount(3);
  await expect(page.locator('[data-unlocked="true"]', { hasText: "First Win" })).toBeVisible();
});

test("hidden achievements stay masked until unlocked", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Achievements" }).click();
  await expect(page.getByText("0 of 19 unlocked")).toBeVisible();
  await expect(page.getByText("Comeback")).toBeHidden();
  await expect(page.getByText("???").first()).toBeVisible();
});

test("an achievement is only awarded once", async ({ page }) => {
  await winCustomPuzzle(page);
  await page.getByRole("button", { name: "Close" }).click();
  await winCustomPuzzle(page);
  // The second win unlocks nothing new (no toast for First Win again).
  await expect(page.getByRole("button", { name: /Achievement unlocked/ })).toHaveCount(0);
});
