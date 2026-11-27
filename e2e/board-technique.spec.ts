/* oxlint-disable eslint/no-await-in-loop -- key presses are inherently sequential */
import { test, expect, type Page } from "@playwright/test";

import { makeRng } from "../app/utils/sudokuCore";
import { generateGradedPuzzle, movesNow } from "../app/utils/sudokuGrader";
import { BOARD, blank, grid, resumeMedium, savedGame } from "./seed";

// Its givens need an XY-Wing, a Hidden Pair and a Pointing Pair (e2e/needed-techniques.spec.ts).
const PUZZLE = ".7.....5....85.2.....6..8.34....9..7..13.......9..53.6......64215.4.....2........";
const SOLUTION =
  "678923451314857269925614873432169587561378924789245316897531642156492738243786195";

const seedSave = (page: Page, save: object, prefs: Record<string, unknown> = {}) =>
  page.addInitScript(
    ([s, p]) => {
      localStorage.setItem("sudoku_v1_save_medium", JSON.stringify(s));
      for (const [k, v] of Object.entries(p)) localStorage.setItem(k, JSON.stringify(v));
    },
    [save, prefs] as const,
  );

const xyWingSave = savedGame({
  currentBoard: grid(PUZZLE),
  initialBoard: grid(PUZZLE),
  solvedBoard: grid(SOLUTION),
});

test("a save from before it was stored works the technique out, names it and keeps it", async ({
  page,
}) => {
  await seedSave(page, xyWingSave);
  await resumeMedium(page);

  const line = page.getByTestId("board-technique");
  await expect(line).toContainText("This board hides: XY-Wing");
  // Shown again over the paused game.
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByTestId("pause-technique")).toHaveText("This board hides: XY-Wing");
  await page.getByRole("button", { name: "Resume" }).first().click();

  // ✕ dismisses it; the next save carries the technique, so a resume needn't work it out again.
  await line.getByRole("button", { name: "Close" }).click();
  await expect(line).toHaveCount(0);
  await page.locator(`${BOARD} [data-cell]`).first().click();
  await page.keyboard.press("6");
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("sudoku_v1_save_medium")!).technique),
    )
    .toBe("xy-wing");
});

test("a stored technique is named; tapping it opens its lesson", async ({ page }) => {
  // A board that needs nothing past singles: the name can only come from the save.
  const board = grid(blank(0, 1));
  await seedSave(
    page,
    savedGame({ technique: "x-wing", currentBoard: board, initialBoard: board }),
  );
  await resumeMedium(page);
  await page.getByTestId("board-technique").getByText("This board hides: X-Wing").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("X-Wing");
  await expect(page.getByRole("button", { name: "Back to game" })).toBeVisible();
});

test("the setting turns the announcement off", async ({ page }) => {
  await seedSave(
    page,
    { ...xyWingSave, technique: "xy-wing" },
    {
      sudoku_v1_pref_announce_technique: false,
    },
  );
  await resumeMedium(page);
  await expect(page.locator(`${BOARD} [data-cell]`).first()).toBeVisible();
  await expect(page.getByTestId("board-technique")).toHaveCount(0);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Resume" }).first()).toBeVisible();
  await expect(page.getByTestId("pause-technique")).toHaveCount(0);
});

test("finishing the board's technique by hand says it was the board's", async ({ page }) => {
  const { puzzle, solution } = generateGradedPuzzle("hard", makeRng(7));
  const move = movesNow(puzzle).find((m) => m.tier >= 2 && !m.placement)!;
  await seedSave(
    page,
    savedGame({
      currentBoard: puzzle,
      initialBoard: puzzle,
      solvedBoard: solution,
      technique: move.technique,
    }),
  );
  await resumeMedium(page);
  const cells = page.locator(`${BOARD} [data-cell]`);
  await page.getByRole("button", { name: "Fill notes" }).click();
  await page.keyboard.press("n");
  for (const e of move.eliminations) {
    await cells.nth(e.r * 9 + e.c).click();
    await page.keyboard.press(String(e.num));
  }
  await expect(page.getByTestId("spotted")).toContainText("You found the board's");
});
