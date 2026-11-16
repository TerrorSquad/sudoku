import { test, expect } from "@playwright/test";

import { BOARD, blank, grid, playCustom, resumeMedium, savedGame } from "./seed";

// generateGradedPuzzle("expert", makeRng(7)): its givens need an XY-Wing, a Hidden Pair and a
// Pointing Pair (pinned in sudokuGrader.test.ts).
const PUZZLE = [
  ".7.....5.",
  "...85.2..",
  "...6..8.3",
  "4....9..7",
  "..13.....",
  "..9..53.6",
  "......642",
  "15.4.....",
  "2........",
];
const SOLUTION = [
  "678923451",
  "314857269",
  "925614873",
  "432169587",
  "561378924",
  "789245316",
  "897531642",
  "156492738",
  "243786195",
];

test("the win modal lists what the givens needed, hardest first, and links to the lesson", async ({
  page,
}) => {
  // A saved game one digit from done: the board left to play needs only a single, but the
  // modal must grade the original givens.
  const currentBoard = grid(SOLUTION.join(""));
  currentBoard[8]![8] = 0;
  await page.addInitScript(
    (save) => localStorage.setItem("sudoku_v1_save_medium", JSON.stringify(save)),
    savedGame({
      currentBoard,
      initialBoard: grid(PUZZLE.join("")),
      solvedBoard: grid(SOLUTION.join("")),
      timerSeconds: 300,
    }),
  );
  await resumeMedium(page);

  await page.locator(`${BOARD} [data-cell]`).nth(80).click();
  await page.getByTestId("numpad").locator("button:not([disabled])").first().click();
  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeVisible();

  const chips = page.getByTestId("needed-techniques").getByRole("button");
  await expect(chips).toHaveText(["XY-Wing", "Hidden Pair", "Pointing Pair"]);

  // Straight into its step-by-step lesson; Back lands on the Academy card.
  await chips.first().click();
  await expect(page.getByRole("heading", { name: "Lesson: XY-Wing" })).toBeVisible();
  await page.getByRole("button", { name: "Back to Academy" }).first().click();
  await expect(page.getByRole("heading", { name: "Sudoku Academy" })).toBeVisible();
  const lesson = page.locator("#lesson-xy-wing");
  await expect(lesson).toBeInViewport();
  await expect(lesson.getByText("Worked example")).toBeVisible();
});

test("a puzzle that needs nothing beyond singles shows the single", async ({ page }) => {
  await page.goto("/");
  await playCustom(page, blank(49));
  await page.locator(`${BOARD} [data-cell]`).nth(49).click();
  await page.getByTestId("numpad").locator("button:not([disabled])").first().click();

  await expect(page.getByTestId("needed-techniques").getByRole("button")).toHaveText([
    "Naked Single",
  ]);
});
