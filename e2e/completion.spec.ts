import { test, expect } from "@playwright/test";

import { SOLVED, cell, place, playCustom } from "./seed";

// Blank cells 0 and 1 (row 1) and 80 (the last cell): two moves complete row 1, the third wins.
const PUZZLE = `00${SOLVED.slice(2, 80)}0`;

test("completing a row ripples outward from the placed digit", async ({ page }) => {
  await page.goto("/");
  await playCustom(page, PUZZLE);

  await place(page, 0, "5");
  await expect(page.locator("[data-cell].cell-flash")).toHaveCount(0);
  await place(page, 1, "3"); // completes row 1, column 2 and box 1 at once, and the last 3

  const flashing = page.locator("[data-cell].cell-flash");
  // 21 cells of the three units, plus the eight 3s outside them.
  await expect(flashing).toHaveCount(29, { timeout: 2000 });
  const delay = (n: number) =>
    cell(page, n).evaluate((e) => (e as HTMLElement).style.animationDelay);
  // The ripple starts at the placed cell (row 1, col 2) and travels outward, 45 ms a step.
  expect(await delay(1)).toBe("0ms");
  expect(await delay(0)).toBe("45ms");
  expect(await delay(8)).toBe("315ms");

  await expect(flashing).toHaveCount(0, { timeout: 3000 });
});

test("winning sweeps the whole board before the result fades in", async ({ page }) => {
  await page.goto("/");
  await playCustom(page, PUZZLE);
  await place(page, 0, "5");
  await place(page, 1, "3");
  await place(page, 80, "9");

  await expect(page.locator("[data-cell].cell-flash")).toHaveCount(81, { timeout: 2000 });
  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeVisible();
});
