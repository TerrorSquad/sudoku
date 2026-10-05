import { test, expect, type Page } from "@playwright/test";

// Pixel-baseline suite. Runs only in the `visual` project (VISUAL_REGRESSION=1,
// see playwright.config.ts); baselines live in e2e/visual-regression-snapshots/.

const PUZZLE = [
  "53..7....",
  "6..195...",
  ".98....6.",
  "8...6...3",
  "4..8.3..1",
  "7...2...6",
  ".6....28.",
  "...419..5",
  "....8..79",
];
const SOLUTION = [
  "534678912",
  "672195348",
  "198342567",
  "859761423",
  "426853791",
  "713924856",
  "961537284",
  "287419635",
  "345286179",
];
const toGrid = (rows: string[]) => rows.map((r) => [...r].map((c) => (c === "." ? 0 : Number(c))));

// A fixed mid-game position: a few correct entries, one wrong entry (r1c3 = 9,
// conflicts with the 9 in its box), and pencil notes in one cell block.
function savedGame() {
  const initialBoard = toGrid(PUZZLE);
  const currentBoard = initialBoard.map((r) => [...r]);
  currentBoard[0]![2] = 9; // wrong: solution is 4
  currentBoard[0]![3] = 6; // correct
  currentBoard[1]![1] = 7; // correct
  const notesBoard = Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => Array<boolean>(10).fill(false)),
  );
  for (const n of [1, 2, 4, 9]) notesBoard[4]![1]![n] = true;
  for (const n of [5, 6]) notesBoard[4]![2]![n] = true;
  return {
    currentBoard,
    initialBoard,
    solvedBoard: toGrid(SOLUTION),
    notesBoard,
    difficulty: "medium",
    timerSeconds: 754,
    mistakes: 1,
    savedAt: 1_700_000_000_000,
  };
}

const BOARD = ".grid.aspect-square.w-full.grid-cols-9";
// The in-game clock only (stats tables also use font-mono/tabular-nums but are static).
const TIMER = ".font-mono.tabular-nums.font-bold";

async function settle(page: Page) {
  // The first capture after a cold dev-server start can land mid-hydration.
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

async function openSavedGame(page: Page) {
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Medium/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(`${BOARD} > div`)).toHaveCount(81);
}

for (const theme of ["light", "dark"] as const) {
  test.describe(theme, () => {
    test.use({ colorScheme: theme });

    test.beforeEach(async ({ page }) => {
      await page.clock.setFixedTime(new Date("2026-01-15T12:00:00"));
      await page.addInitScript((save) => {
        // A real clear must not wipe the seeded save on reload, so only seed once per tab.
        if (!sessionStorage.getItem("seeded")) {
          localStorage.setItem("sudoku_v1_save_medium", JSON.stringify(save));
          // A few unlocked achievements (noon UTC so the date is stable across timezones).
          const noon = Date.UTC(2026, 0, 10, 12);
          localStorage.setItem(
            "sudoku_v1_achievements",
            JSON.stringify({ "first-win": noon, flawless: noon, "streak-3": noon, comeback: noon }),
          );
          // Level 3 with some history, so the menu bar and populated stats are captured.
          localStorage.setItem(
            "sudoku_v1_score",
            JSON.stringify({
              total: 2100,
              gamesWon: 5,
              best: { medium: 640, hard: 910 },
              perDifficulty: {
                medium: { best: 640, wins: 3, bestTime: 412 },
                hard: { best: 910, wins: 2, bestTime: 788 },
              },
            }),
          );
          localStorage.setItem(
            "sudoku_v1_technique_stats",
            JSON.stringify({ "Naked Single": 14, "Hidden Single": 9, "Pointing Pair": 4 }),
          );
          // A few Daily completions around the fixed "today" (2026-01-15) for the stats heat-map.
          for (const day of [
            "2026-01-14",
            "2026-01-13",
            "2026-01-12",
            "2026-01-08",
            "2025-12-30",
          ]) {
            localStorage.setItem(
              `sudoku_v1_daily_${day}`,
              JSON.stringify({ completed: true, time: 500, mistakes: 0 }),
            );
          }
          sessionStorage.setItem("seeded", "1");
        }
      }, savedGame());
      await page.goto("/");
      // Cold dev server: don't capture before the SPA has hydrated.
      await expect(page.getByRole("button", { name: "New Game" })).toBeVisible();
    });

    const shot = async (page: Page, name: string) => {
      await settle(page);
      await expect(page).toHaveScreenshot(`${theme}/${name}.png`, { mask: [page.locator(TIMER)] });
    };

    test("menu", async ({ page }) => {
      await shot(page, "menu");
    });

    test("difficulty", async ({ page }) => {
      await page.getByRole("button", { name: "New Game" }).click();
      await shot(page, "difficulty");
    });

    test("resume prompt", async ({ page }) => {
      await page.getByRole("button", { name: "New Game" }).click();
      await page.getByRole("button", { name: /Medium/ }).click();
      await shot(page, "resume-prompt");
    });

    test("game, nothing selected (conflict + notes)", async ({ page }) => {
      await openSavedGame(page);
      await shot(page, "game");
    });

    test("game, given digit selected", async ({ page }) => {
      await openSavedGame(page);
      await page.locator(`${BOARD} > div`).nth(0).click(); // r1c1 = 5
      await shot(page, "game-select-given");
    });

    test("game, empty cell selected", async ({ page }) => {
      await openSavedGame(page);
      await page
        .locator(`${BOARD} > div`)
        .nth(4 * 9 + 4)
        .click(); // r5c5, empty
      await shot(page, "game-select-empty");
    });

    test("game, wrong entry selected", async ({ page }) => {
      await openSavedGame(page);
      await page.locator(`${BOARD} > div`).nth(2).click(); // r1c3 = 9, conflicting
      await shot(page, "game-select-conflict");
    });

    test("game, paused", async ({ page }) => {
      await openSavedGame(page);
      await page.getByLabel("Pause").click();
      await shot(page, "game-paused");
    });

    test("game, color mode", async ({ page }) => {
      await page.getByRole("button", { name: "Settings" }).click();
      await page.getByRole("switch", { name: "Color mode" }).click();
      await page.reload(); // preference persists; back to the menu
      await openSavedGame(page);
      await page.locator(`${BOARD} > div`).nth(0).click();
      await shot(page, "game-color-mode");
    });

    test("settings", async ({ page }) => {
      await page.getByRole("button", { name: "Settings" }).click();
      await shot(page, "settings");
    });

    test("statistics", async ({ page }) => {
      await page.getByRole("button", { name: "Statistics" }).click();
      await shot(page, "stats");
    });

    test("statistics, empty", async ({ page }) => {
      await page.evaluate(() => {
        localStorage.removeItem("sudoku_v1_score");
        localStorage.removeItem("sudoku_v1_technique_stats");
      });
      await page.getByRole("button", { name: "Statistics" }).click();
      await shot(page, "stats-empty");
    });

    test("academy", async ({ page }) => {
      await page.getByRole("button", { name: "Sudoku Academy" }).click();
      await shot(page, "academy");
    });

    test("achievements", async ({ page }) => {
      await page.getByRole("button", { name: "Achievements" }).click();
      await shot(page, "achievements");
    });

    test("custom puzzle", async ({ page }) => {
      await page.getByRole("button", { name: "Custom Puzzle" }).click();
      await shot(page, "custom-import");
    });
  });
}
