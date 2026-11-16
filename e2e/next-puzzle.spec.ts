import { test, expect } from "@playwright/test";

import { BOARD, resumeMedium, seedMediumSave } from "./seed";

test("Next puzzle on the win screen starts a fresh board at the same level", async ({ page }) => {
  await seedMediumSave(page, [49]);
  await resumeMedium(page);
  const before = await page.locator(`${BOARD} [data-cell]`).allTextContents();
  await page.locator(`${BOARD} [data-cell]`).nth(49).click();
  await page.keyboard.press("2");

  await page.getByTestId("next-puzzle").click();
  await expect(page.getByTestId("next-puzzle")).toHaveCount(0);
  await expect(page.locator(`${BOARD} [data-cell]`)).toHaveCount(81);
  await expect(page.getByText("Medium", { exact: true }).first()).toBeVisible();
  await expect(page.locator(`${BOARD} [data-cell][aria-label*="empty"]`).first()).toBeVisible();
  expect(await page.locator(`${BOARD} [data-cell]`).allTextContents()).not.toEqual(before);
});

test("a custom board's win screen has no Next puzzle", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Your puzzle" }).click();
  await page
    .locator("textarea")
    .fill("034678912672195348198342567859761423426853791713924856961537284287419635345286179");
  await page.getByRole("button", { name: "Play Puzzle" }).click();
  await page.locator(`${BOARD} [data-cell]`).first().click();
  await page.keyboard.press("5");
  await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
  await expect(page.getByTestId("next-puzzle")).toHaveCount(0);
});

test("Enter on the settled win screen plays the next puzzle", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); // the win steps start settled
  await seedMediumSave(page, [49]);
  await resumeMedium(page);
  await page.locator(`${BOARD} [data-cell]`).nth(49).click();
  await page.keyboard.press("2");
  await expect(page.getByTestId("next-puzzle")).toBeVisible();
  await page.locator("body").click({ position: { x: 5, y: 5 } }); // focus off the board's buttons
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("next-puzzle")).toHaveCount(0);
  await expect(page.locator(`${BOARD} [data-cell][aria-label*="empty"]`).first()).toBeVisible();
});

test("? lists the shortcuts and P pauses", async ({ page }) => {
  await seedMediumSave(page, [49, 50]);
  await resumeMedium(page);
  await page.keyboard.press("?");
  const sheet = page.getByRole("dialog", { name: "Keyboard" });
  await expect(sheet.getByText("Pause / resume")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await page.keyboard.press("p");
  await expect(page.getByText("Paused")).toBeVisible();
  await page.keyboard.press("p");
  await expect(page.getByText("Paused")).toBeHidden();
});

test("Share copies the result where there's no share sheet", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined }));
  await seedMediumSave(page, [49]);
  await resumeMedium(page);
  await page.locator(`${BOARD} [data-cell]`).nth(49).click();
  await page.keyboard.press("2");
  await page.getByRole("button", { name: "Share result" }).click();
  await expect(page.getByRole("button", { name: "Copied to clipboard" })).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain("Sudoku Pro · Medium");
  expect(text).toContain("wavedash.com/games/sudoku-pro");
});
