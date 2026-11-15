import type { Page } from "@playwright/test";

export const SOLVED =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

/**
 * Seeds a saved Medium game: SOLVED with the cells at `blanks` empty, `timerSeconds` on the clock.
 * Resume it with `resumeMedium`. Only seeds once, so a reload keeps what the test did.
 */
export async function seedMediumSave(page: Page, blanks: number[], timerSeconds = 3) {
  const grid = (s: string) =>
    Array.from({ length: 9 }, (_, r) => Array.from(s.slice(r * 9, r * 9 + 9), Number));
  const initialBoard = grid(Array.from(SOLVED, (d, i) => (blanks.includes(i) ? "0" : d)).join(""));
  await page.addInitScript(
    (save) => {
      if (!localStorage.getItem("e2e_seeded")) {
        localStorage.setItem("e2e_seeded", "1");
        localStorage.setItem("sudoku_v1_save_medium", JSON.stringify(save));
      }
    },
    {
      currentBoard: initialBoard,
      initialBoard,
      solvedBoard: grid(SOLVED),
      notesBoard: [...Array(9)].map(() => [...Array(9)].map(() => Array(10).fill(false))),
      difficulty: "medium",
      timerSeconds,
      mistakes: 0,
      hintsUsed: 0,
      savedAt: 1_700_000_000_000,
    },
  );
}

export async function resumeMedium(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Medium/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
}

/**
 * Opens every difficulty, as an existing player would have: two Master wins count toward every
 * level below (utils/progression.ts). Only seeds an empty profile, so wins a test makes survive
 * a reload.
 */
export async function unlockAllLevels(page: Page) {
  await page.addInitScript(() => {
    if (localStorage.getItem("sudoku_v1_score")) return;
    localStorage.setItem(
      "sudoku_v1_score",
      JSON.stringify({
        total: 0,
        gamesWon: 2,
        best: {},
        perDifficulty: { master: { best: 0, wins: 2, bestTime: 0 } },
      }),
    );
  });
}
