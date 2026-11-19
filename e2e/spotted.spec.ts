/* oxlint-disable eslint/no-await-in-loop -- key presses are inherently sequential */
import { test, expect } from "@playwright/test";

import { makeRng } from "../app/utils/sudokuCore";
import { generateGradedPuzzle, movesNow } from "../app/utils/sudokuGrader";
import en from "../i18n/locales/en.json" with { type: "json" };
import { BOARD, playCustom } from "./seed";

// A technique finished by hand: take out the last pencil mark it removes, and the game names it.
test("taking out a technique's last pencil mark names it and draws it", async ({ page }) => {
  const { puzzle } = generateGradedPuzzle("hard", makeRng(7));
  const move = movesNow(puzzle).find((m) => m.tier >= 2 && !m.placement)!;
  const name = (en as Record<string, string>)[`hint.move.${move.technique}.name`]!;

  await page.goto("/");
  await playCustom(page, puzzle.flat().join(""));
  const cells = page.locator(`${BOARD} [data-cell]`);
  await page.getByRole("button", { name: "Fill notes" }).click();
  await page.keyboard.press("n");
  for (const [i, e] of move.eliminations.entries()) {
    await cells.nth(e.r * 9 + e.c).click();
    await page.keyboard.press(String(e.num));
    if (i < move.eliminations.length - 1) await expect(page.getByTestId("spotted")).toHaveCount(0);
  }
  const spotted = page.getByTestId("spotted");
  await expect(spotted).toBeVisible();
  await expect(spotted).toContainText(name);
  await expect(page.locator(`${BOARD} [data-testid="pattern-overlay"]`)).toBeVisible();
});
