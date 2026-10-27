import { test, expect, type Page } from "@playwright/test";

const BOARD = ".grid.aspect-square.w-full.grid-cols-9";
const ALMOST_SOLVED =
  "534678912672195348198342567859761423426853791713904856961537284287419635345286179";

// A fake of the SDK Wavedash injects. Like the real one, it rejects the first write to each id,
// standing in for the second half of the stats load not having arrived yet.
async function fakeWavedash(page: Page) {
  await page.addInitScript(() => {
    const unlocked = new Set<string>();
    const tried = new Set<string>();
    const log = { inits: 0, stores: 0, unlocked };
    Object.assign(window, {
      wdLog: log,
      Wavedash: {
        init: () => (log.inits++, true),
        requestStats: async () => ({ success: true, data: true }),
        getAchievement: (id: string) => unlocked.has(id),
        setAchievement: (id: string) => {
          if (!tried.has(id)) return (tried.add(id), false);
          unlocked.add(id);
          return true;
        },
        storeStats: () => (log.stores++, true),
      },
    });
  });
}

/** What the fake saw: init and storeStats calls, and the achievements it accepted. */
const sdkLog = (page: Page) =>
  page.evaluate(() => {
    const log = (
      window as unknown as { wdLog: { inits: number; stores: number; unlocked: Set<string> } }
    ).wdLog;
    return { inits: log.inits, stores: log.stores, unlocked: [...log.unlocked].toSorted() };
  });
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
