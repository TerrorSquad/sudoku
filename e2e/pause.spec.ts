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

test("Settings opens over the paused game, and a theme change shows on the board", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Hard/ }).click();
  await page.getByLabel("Pause").click();

  await page.locator(".pause-overlay").getByRole("button", { name: "Settings" }).click();
  const sheet = page.getByRole("dialog", { name: "Settings" });
  await expect(sheet).toBeVisible();
  // The game stays paused, its overlay covering the board.
  await expect(page.locator(".pause-overlay")).toBeVisible();
  const before = await page.getByTestId("timer").textContent();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("timer")).toHaveText(before ?? "");

  // Language, colour mode and the mistake limit stay put until the game ends; data tools are hidden.
  await expect(sheet.getByText("Locked until this game ends")).toHaveCount(3);
  await expect(sheet.getByRole("button", { name: "Import" })).toHaveCount(0);

  await sheet.getByLabel("Theme").selectOption("newsprint");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "newsprint");
  await expect(page.locator(".board")).toHaveAttribute("data-theme", "newsprint");

  // Keys typed in the sheet never reach the game: P would resume it behind the sheet.
  await page.keyboard.press("p");
  await expect(page.locator(".pause-overlay")).toBeVisible();
  await expect(page.getByTestId("timer")).toHaveText(before ?? "");

  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(page.locator(".pause-overlay")).toBeVisible();
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
  const nudge = page.getByRole("status").filter({ hasText: "Next step:" });
  await expect(nudge).toBeVisible();

  await page.getByLabel("Pause").click();
  await page.locator(".pause-overlay").getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Back to game" }).click();
  await page.locator(".pause-overlay").getByRole("button", { name: "Resume" }).click();

  await expect(three).toHaveAttribute("aria-pressed", "true");
  await expect(nudge).toBeVisible();
});
