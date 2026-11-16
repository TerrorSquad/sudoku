import { test, expect, type Page } from "@playwright/test";

import { fakeWavedash, sdkLog } from "./fakeWavedash";
import { BOARD, SOLVED, blank, grid, openDaily, place, savedGame, unlockAllLevels } from "./seed";

// A Daily for every level: the menu's Daily tile opens the day's picker.

const stored = (page: Page, key: string) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);

test("the Daily picker: open levels play, locked and finished ones don't", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-01-15T12:00:00"));
  await page.addInitScript(() =>
    localStorage.setItem(
      "sudoku_v1_daily_2026-01-15",
      JSON.stringify({ completed: true, time: 300, mistakes: 0 }),
    ),
  );
  await page.goto("/");
  // Any Daily done today marks the tile done; it still opens the picker for the other levels.
  await page.getByRole("button", { name: "Daily done ✓" }).click();
  await expect(page.getByRole("heading", { name: "Today's Dailies" })).toBeVisible();

  // Today's Medium is done: its time shows and it doesn't start again.
  const medium = page.getByRole("button", { name: /\bMedium\b/ });
  await expect(medium).toContainText("Done · 05:00");
  await expect(medium).toHaveAttribute("aria-disabled", "true");
  await medium.click({ force: true }); // aria-disabled: Playwright won't click it otherwise
  await expect(page.getByRole("heading", { name: "Today's Dailies" })).toBeVisible();
  // A fresh player hasn't opened Hard, so its Daily is locked too.
  await expect(page.getByRole("button", { name: /\bHard\b/ })).toHaveAttribute(
    "aria-disabled",
    "true",
  );

  await page.getByRole("button", { name: /\bEasy\b/ }).click();
  await expect(page.locator(`${BOARD} [data-cell]`)).toHaveCount(81);
  await expect(page.getByText("Daily · Easy", { exact: true })).toBeVisible();
  await page.getByLabel("Exit").click();
  // Its own save slot, apart from Easy's and Medium's Daily.
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith("sudoku_v1_save_")),
    ),
  ).toEqual(["sudoku_v1_save_daily_easy"]);
});

test("a Hard Daily records on its own key, keeps the streak and posts to its own board", async ({
  page,
}) => {
  await fakeWavedash(page);
  await page.clock.setFixedTime(new Date("2026-01-15T12:00:00"));
  await unlockAllLevels(page);
  // Started earlier today, one digit from done.
  const initialBoard = grid(blank(40));
  await page.addInitScript(
    (save) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("sudoku_v1_save_daily_hard", JSON.stringify(save));
    },
    savedGame({
      currentBoard: initialBoard,
      initialBoard,
      difficulty: "hard",
      daily: "2026-01-15",
      timerSeconds: 42,
      hintsUsed: 0,
    }),
  );
  await page.goto("/");
  await openDaily(page, "Hard");
  await expect(page.getByText("Daily · Hard", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Daily · Hard", { exact: true })).toBeVisible();
  await place(page, 40, SOLVED[40]!);
  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeVisible();

  expect(await stored(page, "sudoku_v1_daily_hard_2026-01-15")).toMatchObject({ completed: true });
  expect(await stored(page, "sudoku_v1_daily_2026-01-15")).toBeNull(); // Medium's is untouched
  await expect
    .poll(async () => (await sdkLog(page)).uploads.map((u) => u[0]))
    .toEqual(["daily-hard-2026-01-15"]);

  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("button", { name: /Daily done ✓.*1-day streak/ })).toBeVisible();
  await page.getByRole("button", { name: "Daily done ✓" }).click();
  await expect(page.getByRole("button", { name: /\bHard\b/ })).toContainText("Done ·");
});
