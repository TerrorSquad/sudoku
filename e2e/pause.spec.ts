import { test, expect } from "@playwright/test";

import { unlockAllLevels } from "./seed";

// These start Hard, which a fresh profile has locked.
test.beforeEach(({ page }) => unlockAllLevels(page));

test("pausing shows the overlay and freezes the timer; resume hides it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Hard/ }).click();

  await page.getByLabel("Pause").click();
  await expect(page.getByText("Paused")).toBeVisible();

  const timer = page.getByTestId("timer");
  const frozenAt = await timer.textContent();
  await page.waitForTimeout(2200);
  await expect(timer).toHaveText(frozenAt ?? "");

  await page.locator(".pause-overlay").getByRole("button", { name: "Resume" }).click();
  await expect(page.getByText("Paused")).toBeHidden();
});

test("Settings opens from the pause screen and returns to the paused game", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Hard/ }).click();
  await page.getByLabel("Pause").click();
  const frozenAt = await page.getByTestId("timer").textContent();

  await page.locator(".pause-overlay").getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  // Language, colour mode and the mistake limit stay put until the game ends; data tools are hidden.
  await expect(page.getByText("Locked until this game ends")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Import" })).toHaveCount(0);

  await page.getByRole("button", { name: "Back to game" }).click();
  await expect(page.getByText("Paused")).toBeVisible();
  await expect(page.getByTestId("timer")).toHaveText(frozenAt ?? "");
});

test("the Settings detour keeps an armed digit and a shown nudge", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("switch", { name: "Digit-first input" }).click();
  await page.getByLabel("Hint style").selectOption("nudge");
  await page.getByRole("button", { name: "Menu" }).click();
  // A solved grid with the first five cells of row 1 blanked, so 3 is still placeable.
  await page.getByRole("button", { name: "Your puzzle" }).click();
  await page
    .locator("textarea")
    .fill("000008912672195348198342567859761423426853791713924856961537284287419635345286179");
  await page.getByRole("button", { name: "Play Puzzle" }).click();

  const three = page.getByTestId("numpad").getByRole("button", { name: /^3(,|$)/ });
  await three.click();
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  const nudge = page.getByRole("status").filter({ hasText: "Look closely at box" });
  await expect(nudge).toBeVisible();

  await page.getByLabel("Pause").click();
  await page.locator(".pause-overlay").getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Back to game" }).click();
  await page.locator(".pause-overlay").getByRole("button", { name: "Resume" }).click();

  await expect(three).toHaveAttribute("aria-pressed", "true");
  await expect(nudge).toBeVisible();
});
