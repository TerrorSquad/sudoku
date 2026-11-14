import type { Page } from "@playwright/test";

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
