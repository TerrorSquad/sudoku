import type { Page } from "@playwright/test";

/** The game board (the Academy and lesson boards are other grids). */
export const BOARD = ".grid.aspect-square.w-full.grid-cols-9";

export const SOLVED =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

/** SOLVED with the cells at `at` empty. */
export const blank = (...at: number[]) =>
  Array.from(SOLVED, (d, i) => (at.includes(i) ? "0" : d)).join("");

/** 81 digits, "0" or "." for an empty cell, as a 9x9 board. */
export const grid = (s: string) =>
  Array.from({ length: 9 }, (_, r) =>
    Array.from(s.slice(r * 9, r * 9 + 9), (c) => (c === "." ? 0 : Number(c))),
  );

/** A Medium save of SOLVED (every board solved, no notes) unless `overrides` says otherwise. */
export const savedGame = (overrides: Record<string, unknown> = {}) => ({
  currentBoard: grid(SOLVED),
  initialBoard: grid(SOLVED),
  solvedBoard: grid(SOLVED),
  notesBoard: [...Array(9)].map(() => [...Array(9)].map(() => Array<boolean>(10).fill(false))),
  difficulty: "medium",
  timerSeconds: 3,
  mistakes: 0,
  savedAt: 1_700_000_000_000,
  ...overrides,
});

export const cell = (page: Page, n: number) => page.locator(`${BOARD} [data-cell]`).nth(n);

export async function place(page: Page, n: number, digit: string) {
  await cell(page, n).click();
  await page.keyboard.press(digit);
}

/** Plays `puzzle` from the menu through Your puzzle. */
export async function playCustom(page: Page, puzzle: string) {
  await page.getByRole("button", { name: "Your puzzle" }).click();
  await page.locator("textarea").fill(puzzle);
  await page.getByRole("button", { name: "Play Puzzle" }).click();
}

/**
 * Seeds a saved Medium game: SOLVED with the cells at `blanks` empty, `timerSeconds` on the clock.
 * Resume it with `resumeMedium`. Only seeds once, so a reload keeps what the test did.
 */
export async function seedMediumSave(page: Page, blanks: number[], timerSeconds = 3) {
  const initialBoard = grid(blank(...blanks));
  await page.addInitScript(
    (save) => {
      if (!localStorage.getItem("e2e_seeded")) {
        localStorage.setItem("e2e_seeded", "1");
        localStorage.setItem("sudoku_v1_save_medium", JSON.stringify(save));
      }
    },
    savedGame({ currentBoard: initialBoard, initialBoard, timerSeconds, hintsUsed: 0 }),
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
