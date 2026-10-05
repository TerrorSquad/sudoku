import { test, expect } from "@playwright/test";

test("'Nudge first' points at a box, then explains on demand", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Hint style").selectOption("nudge");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Beginner/ }).click();
  await expect(page.locator("[data-cell]")).toHaveCount(81);

  const hint = page.getByRole("button", { name: "Hint", exact: true });
  await hint.click();
  const banner = page.getByRole("status").filter({ hasText: "Look closely at box" });
  await expect(banner).toBeVisible();
  // Exactly one 3×3 box (9 cells) is outlined — minus the selected cell, if any.
  await expect(page.locator("[data-cell].ring-amber-400\\/80")).toHaveCount(9);

  // The banner's button escalates to the full explanation and clears the nudge.
  await banner.getByRole("button", { name: "Explain it" }).click();
  await expect(banner).toBeHidden();
  await expect(page.locator("[data-cell].ring-amber-400\\/80")).toHaveCount(0);
});

test("with the default style the first press explains immediately", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Beginner/ }).click();
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await expect(page.getByText("Look closely at box")).toBeHidden();
});

test("any board change dismisses the nudge", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Hint style").selectOption("nudge");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Beginner/ }).click();
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await expect(page.getByText("Look closely at box")).toBeVisible();
  await page.getByRole("button", { name: "Notes" }).click(); // notes mode alone: still shown
  await expect(page.getByText("Look closely at box")).toBeVisible();
  await page.getByRole("button", { name: "Notes" }).click();
  // Placing a digit changes the board, which dismisses the nudge.
  await page.locator('[data-cell][aria-label$="empty"]').first().click();
  await page.keyboard.press("1");
  await expect(page.getByText("Look closely at box")).toBeHidden();
});
