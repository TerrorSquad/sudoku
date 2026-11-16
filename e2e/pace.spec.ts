import { test, expect, type Page } from "@playwright/test";

import { BOARD, SOLVED, grid, resumeMedium, savedGame } from "./seed";

// A medium save with a few seconds on the clock, plus a medium best of 5 s.
async function seed(page: Page, { zen = false, timerSeconds = 3 } = {}) {
  const initialBoard = grid(SOLVED).map((row) => row.map((v, c) => (c < 4 ? 0 : v)));
  await page.addInitScript(
    ({ save, score }) => {
      localStorage.setItem("sudoku_v1_save_medium", JSON.stringify(save));
      localStorage.setItem("sudoku_v1_score", JSON.stringify(score));
    },
    {
      save: savedGame({ currentBoard: initialBoard, initialBoard, timerSeconds, zen }),
      score: {
        total: 500,
        gamesWon: 1,
        best: { medium: 500 },
        perDifficulty: { medium: { best: 500, wins: 1, bestTime: 5 } },
      },
    },
  );
}

test("shows the difficulty's best time and strikes it through once the clock passes it", async ({
  page,
}) => {
  await page.clock.install();
  await seed(page);
  await resumeMedium(page);
  await expect(page.locator(`${BOARD} [data-cell]`)).toHaveCount(81);

  const best = page.getByTestId("best-time");
  await expect(best).toHaveText("Best 00:05");
  await expect(best).toHaveAttribute("data-past", "false");

  await page.clock.runFor(3_000);
  await expect(best).toHaveAttribute("data-past", "true");
  await expect(best).toHaveCSS("text-decoration-line", "line-through");
  await expect(best).toContainText("slower than your best");
});

test("hidden in Zen, where the timer is hidden too", async ({ page }) => {
  await seed(page, { zen: true });
  await resumeMedium(page);
  await expect(page.locator(`${BOARD} [data-cell]`)).toHaveCount(81);
  await expect(page.getByTestId("best-time")).toHaveCount(0);
});

test("hidden when there's no best yet", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Beginner/ }).click();
  await expect(page.locator(`${BOARD} [data-cell]`)).toHaveCount(81);
  await expect(page.getByTestId("best-time")).toHaveCount(0);
});

test("the Daily paces against the fastest Daily, not the medium best", async ({ page }) => {
  await seed(page);
  await page.addInitScript(() => {
    for (const [day, time] of [
      ["2026-01-02", 260],
      ["2026-01-03", 200],
    ] as const)
      localStorage.setItem(
        `sudoku_v1_daily_${day}`,
        JSON.stringify({ completed: true, time, mistakes: 0 }),
      );
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Daily puzzle" }).click();
  await expect(page.getByTestId("best-time")).toHaveText("Best 03:20");
});
