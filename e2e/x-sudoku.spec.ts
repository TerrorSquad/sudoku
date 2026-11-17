import { test, expect, type Page } from "@playwright/test";

import { BOARD, cell, grid, place, savedGame } from "./seed";

// X-Sudoku ("Diagonal" on the difficulty screen): both long diagonals hold 1–9 once too.

// A solved X grid: every row, column, box and both diagonals hold 1–9.
const XSOLVED = "657198234492763518381452679945837162173926485268514397529381746736249851814675923";
const xBlank = (...at: number[]) =>
  Array.from(XSOLVED, (d, i) => (at.includes(i) ? "0" : d)).join("");

/** Seeds a Medium X-Sudoku save of XSOLVED with the cells at `blanks` empty, once. */
async function seedXSave(page: Page, blanks: number[]) {
  const initialBoard = grid(xBlank(...blanks));
  await page.addInitScript(
    (save) => {
      if (localStorage.getItem("e2e_seeded")) return;
      localStorage.setItem("e2e_seeded", "1");
      localStorage.setItem("sudoku_v1_save_x_medium", JSON.stringify(save));
    },
    savedGame({
      currentBoard: initialBoard,
      initialBoard,
      solvedBoard: grid(XSOLVED),
      variant: "x",
      hintsUsed: 0,
    }),
  );
}

const diagonalSwitch = (page: Page) => page.getByRole("switch", { name: /Diagonal/ });

async function chooseMedium(page: Page, diagonal: boolean) {
  await page.getByRole("button", { name: "New Game" }).click();
  const sw = diagonalSwitch(page);
  if ((await sw.getAttribute("aria-checked")) !== String(diagonal)) await sw.click();
  await page.getByRole("button", { name: /Medium/ }).click();
}

test("Diagonal starts an X game: shaded diagonals, its own save slot", async ({ page }) => {
  await page.goto("/");
  await chooseMedium(page, true);
  await expect(page.locator(`${BOARD} [data-cell]`)).toHaveCount(81);
  await expect(page.locator(`${BOARD} .cell-diag`)).toHaveCount(17);
  await expect(page.getByText("Diagonal · Medium").first()).toBeVisible();
  await page.setViewportSize({ width: 1920, height: 1080 }); // the wide screen's legend
  await expect(page.getByText("Diagonal", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("sudoku_v1_save_"))),
    )
    .toEqual(["sudoku_v1_save_x_medium"]);
});

test("a digit clashing only on a diagonal is a conflict", async ({ page }) => {
  // r1c1 with its row, column and box empty: a 7 there clashes only with r7c7's 7, on the diagonal.
  const rowColBox = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 18, 27, 36, 45, 54, 63, 72, 10, 11, 19, 20];
  await seedXSave(page, rowColBox);
  await page.goto("/");
  await chooseMedium(page, true);
  await page.getByRole("button", { name: "Continue" }).click();
  await place(page, 0, "7");
  await expect(page.getByText("Conflicts with the diagonal!")).toBeAttached();
  await expect(page.getByText(/once per row, column, box and long diagonal/)).toBeVisible();
  await expect(cell(page, 0)).toHaveAttribute("aria-label", /wrong entry 7/);
});

test("winning an X game records it under its own stats row", async ({ page }) => {
  await seedXSave(page, [40]);
  await page.goto("/");
  await chooseMedium(page, true);
  await page.getByRole("button", { name: "Continue" }).click();
  await place(page, 40, "2");
  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeVisible();
  const stats = await page.evaluate(() => JSON.parse(localStorage.getItem("sudoku_v1_score")!));
  expect(stats.perDifficulty.x_medium.wins).toBe(1);
  expect(stats.perDifficulty.medium).toBeUndefined();
  expect(await page.evaluate(() => localStorage.getItem("sudoku_v1_save_x_medium"))).toBeNull();
});

test("the resume prompt follows the Diagonal switch", async ({ page }) => {
  await seedXSave(page, [40]);
  await page.goto("/");
  await chooseMedium(page, false); // no classic Medium save: straight into a new game
  await expect(page.locator(`${BOARD} [data-cell]`)).toHaveCount(81);
  await expect(page.locator(`${BOARD} .cell-diag`)).toHaveCount(0);
  await page.getByLabel("Exit").click();

  await chooseMedium(page, true);
  await expect(page.getByRole("heading", { name: "Saved game found" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(`${BOARD} .cell-diag`)).toHaveCount(17);
  await expect(cell(page, 40)).toHaveAttribute("aria-label", /empty/);
});
