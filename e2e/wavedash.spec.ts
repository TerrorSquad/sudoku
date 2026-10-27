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

test("a win posts its time; custom puzzles post nothing", async ({ page }) => {
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

  await expect.poll(async () => (await sdkLog(page)).uploads.length).toBe(1);
  const [time] = (await sdkLog(page)).uploads;
  expect(time).toEqual(["best-time-medium", expect.any(Number), true, { mistakes: 0, hints: 0 }]);
  expect(time![1]).toBeGreaterThanOrEqual(42);

  // A custom puzzle's win reaches the same code but posts nothing more.
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Custom Puzzle" }).click();
  await page.locator("textarea").fill(ALMOST_SOLVED);
  await page.getByRole("button", { name: "Play Puzzle" }).click();
  await page.locator(`${BOARD} [data-cell]`).nth(49).click();
  await page.getByTestId("numpad").locator("button:not([disabled])").first().click();
  await expect(page.getByRole("heading", { name: "Puzzle Solved!" })).toBeVisible();
  await page.waitForTimeout(300);
  expect((await sdkLog(page)).uploads).toHaveLength(1);
});

test("Stats shows the leaderboards, with Global and Friends tabs and your rank", async ({
  page,
}) => {
  await fakeWavedash(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Statistics" }).click();
  const panel = page.getByRole("region", { name: "Leaderboards" });
  await expect(panel.getByRole("listitem")).toHaveText([
    /Ada\s*30:00/,
    /You\s*25:00/,
    /Bo\s*20:00/,
  ]);
  await expect(panel).toContainText("Your rank: #2 (25:00)");

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

// Cloud saves: progress.json is a Settings export plus updatedAt.
const cloudFile = (data: Record<string, string>, updatedAt: number) =>
  JSON.stringify({
    app: "sudoku-pro",
    version: 1,
    exportedAt: "2026-10-27T00:00:00Z",
    data,
    updatedAt,
  });
const scoreJson = (total: number) =>
  JSON.stringify({ total, gamesWon: 3, perDifficulty: {}, bestTimes: {} });
const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);
const seedLocal = (page: Page, items: Record<string, string>) =>
  page.addInitScript((entries) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
  }, items);

test("a fresh device restores its progress from the cloud", async ({ page }) => {
  await fakeWavedash(page, {
    remote: { "progress.json": cloudFile({ sudoku_v1_score: scoreJson(4321) }, 1000) },
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "New Game" })).toBeVisible();
  expect(JSON.parse((await stored(page, "sudoku_v1_score"))!).total).toBe(4321);
  expect(JSON.parse((await stored(page, "sudoku_cloud_meta"))!).syncedAt).toBe(1000);
  expect((await sdkLog(page)).fileUploads).toBe(0);
  // Restored before the app mounted, so the screens read it without a reload.
  await page.getByRole("button", { name: "Statistics" }).click();
  await expect(page.getByText("4,321").first()).toBeVisible();
});

test("local progress newer than the last sync is uploaded", async ({ page }) => {
  const old = cloudFile({ sudoku_v1_score: scoreJson(100) }, 1000);
  await fakeWavedash(page, { remote: { "progress.json": old } });
  await seedLocal(page, {
    sudoku_v1_score: scoreJson(900),
    sudoku_cloud_meta: JSON.stringify({ syncedAt: 1000, syncedHash: "older" }),
  });
  await page.goto("/");
  await expect.poll(async () => (await sdkLog(page)).fileUploads).toBe(1);
  const remote = JSON.parse((await sdkLog(page)).remote["progress.json"]!);
  expect(JSON.parse(remote.data.sudoku_v1_score).total).toBe(900);
  expect(JSON.parse((await stored(page, "sudoku_v1_score"))!).total).toBe(900);
});

test("a corrupt cloud file never touches local progress", async ({ page }) => {
  await fakeWavedash(page, { remote: { "progress.json": "{not json" } });
  await seedLocal(page, { sudoku_v1_score: scoreJson(700) });
  await page.goto("/");
  await expect.poll(async () => (await sdkLog(page)).fileUploads).toBe(1);
  expect(JSON.parse((await stored(page, "sudoku_v1_score"))!).total).toBe(700);
  // The upload replaced the corrupt file with local progress.
  const remote = JSON.parse((await sdkLog(page)).remote["progress.json"]!);
  expect(JSON.parse(remote.data.sudoku_v1_score).total).toBe(700);
});

test("a win uploads progress to the cloud", async ({ page }) => {
  await fakeWavedash(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Custom Puzzle" }).click();
  await page.locator("textarea").fill(ALMOST_SOLVED);
  await page.getByRole("button", { name: "Play Puzzle" }).click();
  await page.locator(`${BOARD} [data-cell]`).nth(49).click();
  await page.getByTestId("numpad").locator("button:not([disabled])").first().click();
  await expect(page.getByRole("heading", { name: "Puzzle Solved!" })).toBeVisible();
  await expect.poll(async () => (await sdkLog(page)).fileUploads).toBe(1);
  const remote = JSON.parse((await sdkLog(page)).remote["progress.json"]!);
  expect(JSON.parse(remote.data.sudoku_v1_score).total).toBeGreaterThan(0);
  expect(typeof remote.updatedAt).toBe("number");
});
