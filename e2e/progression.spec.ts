import { test, expect } from "@playwright/test";

const BOARD = ".grid.aspect-square.w-full.grid-cols-9";
const ALMOST_SOLVED =
  "534678912672195348198342567859761423426853791713904856961537284287419635345286179";

test("a fast flawless first win crosses level 2 and the menu shows it", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("level-badge")).toContainText("Level 1");

  await page.getByRole("button", { name: "Custom Puzzle" }).click();
  await page.locator("textarea").fill(ALMOST_SOLVED);
  await page.getByRole("button", { name: "Play Puzzle" }).click();
  await page.locator(`${BOARD} > div`).nth(49).click();
  await page.locator(".grid-cols-5").nth(1).locator("button:not([disabled])").first().click();

  await expect(page.getByText("Level up! You reached level 2")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("level-badge")).toContainText("Level 2");
});

test("a clean win shows three stars", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Custom Puzzle" }).click();
  await page.locator("textarea").fill(ALMOST_SOLVED);
  await page.getByRole("button", { name: "Play Puzzle" }).click();
  await page.locator(`${BOARD} > div`).nth(49).click();
  await page.locator(".grid-cols-5").nth(1).locator("button:not([disabled])").first().click();
  await expect(page.getByRole("img", { name: "3 out of 3 stars" })).toBeVisible();
});
