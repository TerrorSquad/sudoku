import { test, expect } from "@playwright/test";

const BOARD = ".grid.aspect-square.w-full.grid-cols-9";
const ALMOST_SOLVED =
  "534678912672195348198342567859761423426853791713904856961537284287419635345286179";

test("undo and redo step a placement via buttons and keyboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Custom Puzzle" }).click();
  // Two blanks so the puzzle isn't won by the first placement.
  const two =
    ALMOST_SOLVED.slice(0, 1) + "0" + ALMOST_SOLVED.slice(2, 49) + "0" + ALMOST_SOLVED.slice(50);
  await page.locator("textarea").fill(two);
  await page.getByRole("button", { name: "Play Puzzle" }).click();

  const cell = page.locator(`${BOARD} [data-cell]`).nth(1);
  const undo = page.getByRole("button", { name: "Undo" });
  const redo = page.getByRole("button", { name: "Redo" });
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();

  await cell.click();
  await page.keyboard.press("3");
  await expect(cell).toHaveText("3");
  await expect(undo).toBeEnabled();

  await undo.click();
  await expect(cell).not.toHaveText("3");
  await expect(redo).toBeEnabled();

  await redo.click();
  await expect(cell).toHaveText("3");

  await page.keyboard.press("Control+z");
  await expect(cell).not.toHaveText("3");
  await page.keyboard.press("Control+Shift+z");
  await expect(cell).toHaveText("3");
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+y");
  await expect(cell).toHaveText("3");
});

test("browser shortcuts don't trigger game actions", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Easy/ }).click();
  await page.keyboard.press("Control+n");
  // N toggles notes mode; with Ctrl held it must not (the notes dot stays idle).
  await expect(page.locator("span.bg-violet-500.rounded-full")).toHaveCount(0);
});

const ONE_BLANK =
  "534678912672195348198342567859761423426853791713904856961537284287419635345286179";

test("shortcuts are inert behind the win modal (no second win, board intact)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Custom Puzzle" }).click();
  await page.locator("textarea").fill(ONE_BLANK);
  await page.getByRole("button", { name: "Play Puzzle" }).click();
  await page.locator(`${BOARD} [data-cell]`).nth(49).click();
  await page.getByTestId("numpad").locator("button:not([disabled])").first().click();
  await expect(page.getByRole("heading", { name: "Puzzle Solved!" })).toBeVisible();

  const cell = page.locator(`${BOARD} [data-cell]`).nth(49);
  const solved = await cell.textContent();
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Backspace");
  await expect(cell).toHaveText(solved ?? "");
  await expect(page.getByRole("heading", { name: "Puzzle Solved!" })).toBeVisible();
});

test("redo restores an edit without declaring a win", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Custom Puzzle" }).click();
  await page.locator("textarea").fill(ONE_BLANK);
  await page.getByRole("button", { name: "Play Puzzle" }).click();
  const cell = page.locator(`${BOARD} [data-cell]`).nth(49);
  await cell.click();
  await page.keyboard.press("1"); // wrong digit for this cell
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+y");
  await expect(cell).toHaveText("1");
  await expect(page.getByRole("heading", { name: "Puzzle Solved!" })).toBeHidden();
});

test("the grid has exactly one Tab stop, following the selection", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Beginner/ }).click();
  await expect(page.locator('[data-cell][tabindex="0"]')).toHaveCount(1);
  await expect(page.locator('[data-cell="0-0"]')).toHaveAttribute("tabindex", "0");
  await page.locator('[data-cell="4-4"]').click();
  await expect(page.locator('[data-cell][tabindex="0"]')).toHaveCount(1);
  await expect(page.locator('[data-cell="4-4"]')).toHaveAttribute("tabindex", "0");
});
