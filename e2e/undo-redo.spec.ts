import { test, expect } from "@playwright/test";

import { BOARD, blank, cell as at, playCustom } from "./seed";

test("undo and redo step a placement via buttons and keyboard", async ({ page }) => {
  await page.goto("/");
  // Two blanks so the puzzle isn't won by the first placement.
  await playCustom(page, blank(1, 49));

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

const ONE_BLANK = blank(49);

test("shortcuts are inert behind the win modal (no second win, board intact)", async ({ page }) => {
  await page.goto("/");
  await playCustom(page, ONE_BLANK);
  await page.locator(`${BOARD} [data-cell]`).nth(49).click();
  await page.getByTestId("numpad").locator("button:not([disabled])").first().click();
  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeVisible();

  const cell = page.locator(`${BOARD} [data-cell]`).nth(49);
  const solved = await cell.textContent();
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Backspace");
  await expect(cell).toHaveText(solved ?? "");
  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeVisible();
});

test("redo restores an edit without declaring a win", async ({ page }) => {
  await page.goto("/");
  await playCustom(page, ONE_BLANK);
  const cell = page.locator(`${BOARD} [data-cell]`).nth(49);
  await cell.click();
  await page.keyboard.press("1"); // wrong digit for this cell
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+y");
  await expect(cell).toHaveText("1");
  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeHidden();
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

test("the move history scrubs to any kept state, and play goes on from there", async ({ page }) => {
  await page.goto("/");
  await playCustom(page, blank(1, 2, 3, 49));
  await page.keyboard.press("n"); // pencil marks: no mistakes to count
  await at(page, 1).click();
  await page.keyboard.press("1");
  await at(page, 2).click();
  await page.keyboard.press("2");
  await at(page, 3).click();
  await page.keyboard.press("3");
  const history = page.getByRole("dialog", { name: "Move history" });
  const slider = history.getByRole("slider", { name: "Move history" });

  // Holding Undo opens it, and the press doesn't also undo.
  await page.getByRole("button", { name: "Undo" }).hover();
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect(history).toBeVisible();
  await expect(at(page, 3)).toHaveText("3");
  await expect(slider).toHaveValue("3");
  await page.keyboard.press("Escape");
  await expect(history).toBeHidden();

  await page.keyboard.press("Shift+Z");
  await expect(history).toBeVisible();
  await slider.press("Home");
  await expect(slider).toHaveValue("0");
  await expect(at(page, 1)).toHaveText("");
  await expect(at(page, 3)).toHaveText("");
  await slider.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuetext", "Move 1 of 3");
  await expect(at(page, 1)).toHaveText("1");
  await expect(at(page, 2)).toHaveText("");
  await history.getByRole("button", { name: "Close" }).click();

  // Like many undos: redo can step forward, and a fresh edit drops what was undone.
  const redo = page.getByRole("button", { name: "Redo" });
  await expect(redo).toBeEnabled();
  await at(page, 49).click();
  await page.keyboard.press("9");
  await expect(redo).toBeDisabled();
});
