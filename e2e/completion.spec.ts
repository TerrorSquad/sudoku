import { test, expect, type Page } from "@playwright/test";

const BOARD = ".grid.aspect-square.w-full.grid-cols-9";
const SOLVED = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
// Blank cells 0 and 1 (row 1) and 80 (the last cell): two moves complete row 1, the third wins.
const PUZZLE = `00${SOLVED.slice(2, 80)}0`;

const cell = (page: Page, n: number) => page.locator(`${BOARD} [data-cell]`).nth(n);

async function place(page: Page, n: number, digit: string) {
  await cell(page, n).click();
  await page.keyboard.press(digit);
}

test("completing a row ripples outward from the placed digit", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Custom Puzzle" }).click();
  await page.locator("textarea").fill(PUZZLE);
  await page.getByRole("button", { name: "Play Puzzle" }).click();

  await place(page, 0, "5");
  await expect(page.locator("[data-cell].cell-flash")).toHaveCount(0);
  await place(page, 1, "3"); // completes row 1, column 2 and box 1 at once

  const flashing = page.locator("[data-cell].cell-flash");
  await expect(flashing).toHaveCount(21, { timeout: 2000 });
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
  await page.getByRole("button", { name: "Custom Puzzle" }).click();
  await page.locator("textarea").fill(PUZZLE);
  await page.getByRole("button", { name: "Play Puzzle" }).click();
  await place(page, 0, "5");
  await place(page, 1, "3");
  await place(page, 80, "9");

  await expect(page.locator("[data-cell].cell-flash")).toHaveCount(81, { timeout: 2000 });
  await expect(page.getByRole("heading", { name: "Puzzle Solved!" })).toBeVisible();
});
