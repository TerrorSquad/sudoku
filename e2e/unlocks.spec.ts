import { test, expect, type Page } from "@playwright/test";

const BOARD = ".grid.aspect-square.w-full.grid-cols-9";
const SOLVED = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
const grid = (s: string) =>
  Array.from({ length: 9 }, (_, r) => Array.from(s.slice(r * 9, r * 9 + 9), Number));
/** A saved game at `difficulty`, one digit (cell 40) from done. */
const almostWon = (difficulty: string) => {
  const puzzle = SOLVED.slice(0, 40) + "0" + SOLVED.slice(41);
  return {
    currentBoard: grid(puzzle),
    initialBoard: grid(puzzle),
    solvedBoard: grid(SOLVED),
    notesBoard: Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => Array<boolean>(10).fill(false)),
    ),
    difficulty,
    timerSeconds: 100,
    mistakes: 0,
    savedAt: 1_700_000_000_000,
  };
};
// The same lookup the older specs use: a locked tile's requirement ("…on Medium…") is its
// description, not its name, so it never matches another level's name.
const tile = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(name) });

test("a fresh profile sees Hard and up locked, with what opens them", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();

  const hard = tile(page, "Hard");
  await expect(hard).toHaveAttribute("aria-disabled", "true");
  await expect(hard).toHaveAccessibleDescription(
    "Win 2 games on Medium or harder to unlock (0/2)",
  );
  await expect(tile(page, "Master")).toHaveText(/Win 2 games on Expert or harder/);
  await expect(tile(page, "Medium")).not.toHaveAttribute("aria-disabled", "true");

  // Clicking a locked level starts nothing (force: Playwright won't click aria-disabled).
  await hard.click({ force: true });
  await expect(page.getByRole("heading", { name: "Choose a difficulty" })).toBeVisible();
  await expect(page.locator(`${BOARD} [data-cell]`)).toHaveCount(0);
});

test("a second Medium win unlocks Hard and says so", async ({ page }) => {
  await page.addInitScript(
    ([save]) => {
      if (localStorage.getItem("sudoku_v1_score")) return;
      localStorage.setItem(
        "sudoku_v1_score",
        JSON.stringify({
          total: 100,
          gamesWon: 1,
          best: { medium: 100 },
          perDifficulty: { medium: { best: 100, wins: 1, bestTime: 300 } },
        }),
      );
      localStorage.setItem("sudoku_v1_save_medium", JSON.stringify(save));
    },
    [almostWon("medium")],
  );
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await expect(tile(page, "Hard")).toHaveAccessibleDescription(/\(1\/2\)/);

  await tile(page, "Medium").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator(`${BOARD} [data-cell]`).nth(40).click();
  await page.getByTestId("numpad").locator("button:not([disabled])").first().click();
  await expect(page.getByText("Hard unlocked!")).toBeVisible();

  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "New Game" }).click();
  await expect(tile(page, "Hard")).not.toHaveAttribute("aria-disabled", "true");
  await expect(tile(page, "Expert")).toHaveAccessibleDescription(/Hard or harder.*\(0\/2\)/);
});

test("a level with a game in progress stays open", async ({ page }) => {
  await page.addInitScript(
    ([save]) => localStorage.setItem("sudoku_v1_save_expert", JSON.stringify(save)),
    [almostWon("expert")],
  );
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await expect(tile(page, "Expert")).not.toHaveAttribute("aria-disabled", "true");
  await tile(page, "Expert").click();
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
});
