import { test, expect, type Page } from "@playwright/test";

import { fakeWavedash, sdkLog } from "./fakeWavedash";

const BOARD = ".grid.aspect-square.w-full.grid-cols-9";
const ALMOST_SOLVED =
  "534678912672195348198342567859761423426853791713904856961537284287419635345286179";

const unlockedIds = async (page: Page) => (await sdkLog(page)).unlocked;

test("boot calls init and back-fills achievements unlocked before", async ({ page }) => {
  await fakeWavedash(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      "sudoku_v1_achievements",
      JSON.stringify({ "first-win": 1, "streak-3": 2 }),
    ),
  );
  await page.goto("/");
  await expect.poll(() => unlockedIds(page)).toEqual(["FIRST_WIN", "STREAK_3"]);
  expect((await sdkLog(page)).inits).toBe(1);
});

test("a win reports its new achievements and stores them", async ({ page }) => {
  await fakeWavedash(page);
  // Night Owl keys off the real hour; pin the clock so the unlock set is deterministic.
  await page.clock.setFixedTime(new Date("2026-01-15T12:00:00"));
  await page.goto("/");
  await page.getByRole("button", { name: "Custom Puzzle" }).click();
  await page.locator("textarea").fill(ALMOST_SOLVED);
  await page.getByRole("button", { name: "Play Puzzle" }).click();
  await page.locator(`${BOARD} [data-cell]`).nth(49).click();
  await page.getByTestId("numpad").locator("button:not([disabled])").first().click();
  await expect(page.getByRole("heading", { name: "Puzzle Solved!" })).toBeVisible();
  await expect.poll(() => unlockedIds(page)).toEqual(["FIRST_WIN", "FLAWLESS", "SELF_RELIANT"]);
  expect((await sdkLog(page)).stores).toBeGreaterThan(0);
});

const grid = (s: string) =>
  Array.from({ length: 9 }, (_, r) => Array.from(s.slice(r * 9, r * 9 + 9), Number));

test("a win posts its time and the lifetime total; custom puzzles post nothing", async ({
  page,
}) => {
  await fakeWavedash(page);
  const solved = ALMOST_SOLVED.replace("0", "2");
  const puzzle = solved.slice(0, 40) + "0" + solved.slice(41);
  const save = {
    currentBoard: grid(puzzle),
    initialBoard: grid(puzzle),
    solvedBoard: grid(solved),
    notesBoard: Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => Array<boolean>(10).fill(false)),
    ),
    difficulty: "medium",
    timerSeconds: 42,
    mistakes: 0,
    hintsUsed: 0,
    savedAt: 1_700_000_000_000,
  };
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("sudoku_v1_save_medium", JSON.stringify(s));
    }
  }, save);
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Medium/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator(`${BOARD} [data-cell]`).nth(40).click();
  await page.getByTestId("numpad").locator("button:not([disabled])").first().click();
  await expect(page.getByRole("heading", { name: "Puzzle Solved!" })).toBeVisible();

  await expect.poll(async () => (await sdkLog(page)).uploads.length).toBe(2);
  const [time, lifetime] = (await sdkLog(page)).uploads.toSorted();
  expect(time).toEqual(["best-time-medium", expect.any(Number), true, { mistakes: 0, hints: 0 }]);
  expect(time![1]).toBeGreaterThanOrEqual(42);
  expect(lifetime).toEqual(["lifetime-score", expect.any(Number), true, { mistakes: 0, hints: 0 }]);

  // A custom puzzle's win reaches the same code but posts nothing more.
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Custom Puzzle" }).click();
  await page.locator("textarea").fill(ALMOST_SOLVED);
  await page.getByRole("button", { name: "Play Puzzle" }).click();
  await page.locator(`${BOARD} [data-cell]`).nth(49).click();
  await page.getByTestId("numpad").locator("button:not([disabled])").first().click();
  await expect(page.getByRole("heading", { name: "Puzzle Solved!" })).toBeVisible();
  await page.waitForTimeout(300);
  expect((await sdkLog(page)).uploads).toHaveLength(2);
});

test("Stats shows the leaderboards, with Global and Friends tabs and your rank", async ({
  page,
}) => {
  await fakeWavedash(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Statistics" }).click();
  const panel = page.getByRole("region", { name: "Leaderboards" });
  await expect(panel.getByRole("listitem")).toHaveText([
    /Ada\s*1,800/,
    /You\s*1,500/,
    /Bo\s*1,200/,
  ]);
  await expect(panel).toContainText("Your rank: #2 (1,500)");

  await panel.getByRole("button", { name: "Friends" }).click();
  await expect(panel.getByRole("listitem")).toHaveText([/Friendly Fox/, /You/]);

  await panel
    .getByRole("combobox", { name: "Leaderboard" })
    .selectOption({ label: "Best time: Hard" });
  await expect(panel.getByRole("listitem").first()).toContainText("30:00");
});

test("without Wavedash, Stats has no leaderboards", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Statistics" }).click();
  await expect(page.getByRole("heading", { name: "Your Statistics" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Leaderboards" })).toHaveCount(0);
});
