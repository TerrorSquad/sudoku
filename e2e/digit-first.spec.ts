import { test, expect, type Page } from "@playwright/test";

import { blank, cell, playCustom } from "./seed";

// A solved grid with the first five cells of row 1 blanked (answers 5 3 4 6 7).
const FIVE_BLANKS = blank(0, 1, 2, 3, 4);

const pad = (page: Page, digit: string) =>
  page.getByTestId("numpad").getByRole("button", { name: new RegExp(`^${digit}(,|$)`) });

async function startDigitFirstGame(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("switch", { name: "Digit-first input" }).click();
  await page.getByRole("button", { name: "Menu" }).click();
  await playCustom(page, FIVE_BLANKS);
}

test("arm a digit, then tap cells to place it", async ({ page }) => {
  await startDigitFirstGame(page);
  await pad(page, "3").click();
  await expect(pad(page, "3")).toHaveAttribute("aria-pressed", "true");

  await cell(page, 0).click();
  await expect(cell(page, 0)).toHaveText("3");
  // Tapping the same cell again removes it (3 is wrong here, so the digit stays armed).
  await cell(page, 0).click();
  await expect(cell(page, 0)).not.toHaveText("3");

  // Placing the last missing 5 completes the digit, which disarms it.
  await pad(page, "5").click();
  await cell(page, 0).click();
  await expect(cell(page, 0)).toHaveText("5");
  await expect(pad(page, "5")).toBeDisabled();
});

test("candidate cells are marked and given cells are never overwritten", async ({ page }) => {
  await startDigitFirstGame(page);
  await pad(page, "3").click();
  // Cell 1 (row 1, col 2) can take 3; cell 5 already holds 8 and is a given.
  await expect(cell(page, 1)).toHaveClass(/ring-violet-400\/50/);
  await cell(page, 5).click();
  await expect(cell(page, 5)).toHaveText("8");
});

test("arrow keys move without placing; Escape disarms; tapping the armed pad button disarms", async ({
  page,
}) => {
  await startDigitFirstGame(page);
  await pad(page, "5").click();
  await cell(page, 1).click(); // places 5 (wrong here) — fine, we only care about navigation next
  await page.keyboard.press("ArrowLeft");
  await expect(cell(page, 0)).toHaveAttribute("aria-selected", "true");
  await expect(cell(page, 0)).not.toHaveText("5");

  await page.keyboard.press("Escape");
  await expect(pad(page, "5")).toHaveAttribute("aria-pressed", "false");

  await pad(page, "4").click();
  await pad(page, "4").click();
  await expect(pad(page, "4")).toHaveAttribute("aria-pressed", "false");
});

test("the numpad keeps accessible names in colour mode", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("switch", { name: "Color mode" }).click();
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Beginner/ }).click();
  await expect(page.getByTestId("numpad").getByRole("button", { name: "red" })).toBeVisible();
});

test("a stray tap with another digit armed never replaces an existing entry", async ({ page }) => {
  await startDigitFirstGame(page);
  await pad(page, "3").click();
  await cell(page, 0).click(); // wrong 3 into cell 0
  await expect(cell(page, 0)).toHaveText("3");
  await pad(page, "4").click();
  await cell(page, 0).click(); // 4 is armed; cell 0 already holds a different entry
  await expect(cell(page, 0)).toHaveText("3");
});

test("selecting a placed digit outlines where it can still go, following notes", async ({
  page,
}) => {
  await page.goto("/");
  await playCustom(page, FIVE_BLANKS);

  await cell(page, 15).click(); // a given 3 (row 2)
  await expect(cell(page, 1)).toHaveClass(/ring-violet-400\/50/);

  // Notes that leave 3 out rule the cell out.
  await cell(page, 1).click();
  await page.keyboard.press("n");
  await page.keyboard.press("4");
  await page.keyboard.press("n");
  await cell(page, 15).click();
  await expect(cell(page, 1)).not.toHaveClass(/ring-violet-400\/50/);
});
