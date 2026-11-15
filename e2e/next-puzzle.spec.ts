import { test, expect } from "@playwright/test";

import { resumeMedium, seedMediumSave } from "./seed";

const BOARD = ".grid.aspect-square.w-full.grid-cols-9";

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
