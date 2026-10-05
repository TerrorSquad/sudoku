import { test, expect } from "@playwright/test";
test("entrance class drops after the animation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Beginner/ }).click();
  await expect(page.locator('[data-cell="8-8"]')).toBeVisible();
  await expect(page.locator("[data-cell].cell-in")).toHaveCount(0, { timeout: 3000 });
});
