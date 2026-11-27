import { test, expect } from "@playwright/test";

import { BOARD, blank, grid, resumeMedium, savedGame } from "./seed";

test("the win modal recaps what the hints were for and opens its lesson", async ({ page }) => {
  // A resumed game whose hints already applied an XY-Wing twice (an older save would have none),
  // with two cells left; the singles' lessons are done, the XY-Wing's isn't.
  const board = grid(blank(0, 1));
  await page.addInitScript(
    ([save, stars]) => {
      localStorage.setItem("sudoku_v1_save_medium", JSON.stringify(save));
      localStorage.setItem("sudoku_v1_lesson_stars", JSON.stringify(stars));
    },
    [
      savedGame({
        currentBoard: board,
        initialBoard: board,
        hintsUsed: 2,
        hinted: { "xy-wing": 2 },
      }),
      { "naked-single": 3, "hidden-single": 3 },
    ] as const,
  );
  await resumeMedium(page);

  // A second press applies the hint at once.
  const hint = page.getByRole("button", { name: "Hint", exact: true });
  await hint.click();
  await hint.click();
  await expect(page.locator(`${BOARD} [data-cell][aria-label$="empty"]`)).toHaveCount(1);

  // The count is saved with the game.
  const hinted = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("sudoku_v1_save_medium")!).hinted);
  await expect.poll(async () => Object.values(await hinted()).toSorted()).toEqual([1, 2]);
  expect((await hinted())["xy-wing"]).toBe(2);

  await page.locator(`${BOARD} [data-cell][aria-label$="empty"]`).click();
  await page.getByTestId("numpad").locator("button:not([disabled])").first().click();
  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeVisible();

  // Hardest first; a lesson already done is offered again.
  const rows = page.getByTestId("hint-recap").getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("XY-Wing · hinted 2×");
  await expect(rows.first().getByRole("button")).toHaveText("Learn it");
  await expect(rows.nth(1)).toContainText(/Single · hinted 1×/);
  await expect(rows.nth(1).getByRole("button")).toHaveText("Replay its lesson");

  // Into the lesson; its Back lands on the Academy, not the finished game.
  await rows.first().getByRole("button").click();
  await expect(page.getByRole("heading", { name: "Lesson: XY-Wing" })).toBeVisible();
  await page.getByRole("button", { name: "Back to Academy" }).first().click();
  await expect(page.getByRole("heading", { name: "Sudoku Academy" })).toBeVisible();
});

test("a win without hints has no recap", async ({ page }) => {
  const board = grid(blank(0));
  await page.addInitScript(
    (save) => localStorage.setItem("sudoku_v1_save_medium", JSON.stringify(save)),
    savedGame({ currentBoard: board, initialBoard: board }),
  );
  await resumeMedium(page);
  await page.locator(`${BOARD} [data-cell]`).first().click();
  await page.getByTestId("numpad").locator("button:not([disabled])").first().click();
  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeVisible();
  await expect(page.getByTestId("perfect-stamp")).toBeVisible();
  await expect(page.getByTestId("hint-recap")).toHaveCount(0);
});
