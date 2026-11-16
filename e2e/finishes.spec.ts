import { test, expect } from "@playwright/test";

import { blank, place, playCustom, resumeMedium, seedMediumSave } from "./seed";

test("placing the last 5 lights up all nine 5s", async ({ page }) => {
  // Cell 40 is the last 5; 39 and 4 stay open so its row, column and box are not complete.
  await page.goto("/");
  await playCustom(page, blank(4, 39, 40));
  await place(page, 40, "5");

  const flashing = page.locator("[data-cell].cell-flash");
  await expect(flashing).toHaveCount(9, { timeout: 2000 });
  const fives = [0, 14, 24, 28, 40, 52, 57, 71, 74].map((n) => `${Math.floor(n / 9)}-${n % 9}`);
  const lit = await flashing.evaluateAll((els) => els.map((e) => e.getAttribute("data-cell")));
  expect(lit.toSorted()).toEqual(fives.toSorted());
  await expect(flashing).toHaveCount(0, { timeout: 3000 });
});

test("a clean win is stamped Perfect, after the stars and score lines play in", async ({
  page,
}) => {
  await page.goto("/");
  await playCustom(page, blank(49));
  await place(page, 49, "2");

  const stamp = page.getByTestId("perfect-stamp");
  // In the DOM at once with its text (and the real total beside the counter), shown last.
  await expect(stamp).toHaveText("Perfect!");
  await expect(stamp).toHaveClass(/opacity-0/);
  await expect(page.getByRole("img", { name: "3 out of 3 stars" })).toBeVisible();
  await expect(stamp).toHaveClass(/stamp-in/, { timeout: 4000 });
});

test("a key skips the win modal's steps to the end, once they have started", async ({ page }) => {
  await page.goto("/");
  await playCustom(page, blank(49));
  await place(page, 49, "2");
  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeVisible();
  // Before the first step (still behind the win wave) a key skips nothing.
  await page.keyboard.press("Shift");
  await expect(page.locator(".win-done")).toHaveCount(0);
  await page.locator(".star-pop").first().waitFor({ timeout: 3000 });
  await page.keyboard.press("Shift");
  await expect(page.getByTestId("perfect-stamp")).toHaveClass(/stamp-in/, { timeout: 300 });
  await expect(page.locator(".star-pop")).toHaveCount(3);
});

test("a win with a mistake gets no stamp", async ({ page }) => {
  await page.goto("/");
  await playCustom(page, blank(49));
  await place(page, 49, "3"); // wrong
  await place(page, 49, "2");
  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeVisible();
  await expect(page.getByRole("img", { name: "2 out of 3 stars" })).toBeVisible();
  await expect(page.getByTestId("perfect-stamp")).toHaveCount(0);
});

test("custom boards don't count toward records", async ({ page }) => {
  await page.goto("/");
  await playCustom(page, blank(49));
  await place(page, 49, "2");
  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("sudoku_v1_records"))).toBeNull();
});

test("the first mistake ends the clean run, even if the game is abandoned", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "sudoku_v1_records",
      JSON.stringify({ cleanRun: 3, bestCleanRun: 3, mostInDay: 1 }),
    ),
  );
  await seedMediumSave(page, [48, 49]);
  await resumeMedium(page);
  await place(page, 49, "3"); // wrong
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("sudoku_v1_records")!)))
    .toMatchObject({ cleanRun: 0, bestCleanRun: 3 });
});

test("a win that breaks a record says so on the win modal", async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("sudoku_v1_records")) return;
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    localStorage.setItem(
      "sudoku_v1_records",
      JSON.stringify({ day, dayWins: 1, mostInDay: 1, cleanRun: 1, bestCleanRun: 1 }),
    );
    localStorage.setItem(
      "sudoku_v1_score",
      JSON.stringify({
        total: 500,
        gamesWon: 1,
        best: { medium: 500 },
        perDifficulty: { medium: { best: 500, wins: 1, bestTime: 400 } },
      }),
    );
  });
  await seedMediumSave(page, [49], 100);
  await resumeMedium(page);
  await place(page, 49, "2");

  // Fastest first; the clean run makes the second line, the day's wins don't fit.
  const lines = page.getByTestId("new-record");
  await expect(lines).toHaveCount(2);
  await expect(lines.nth(0)).toHaveText(/^New record: fastest Medium, 01:4\d \(was 06:40\)$/);
  await expect(lines.nth(1)).toHaveText("New record: 2 wins in a row without a mistake (was 1)");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("sudoku_v1_records")!));
  expect(stored).toMatchObject({ dayWins: 2, mostInDay: 2, cleanRun: 2, bestCleanRun: 2 });
});

test("the stats screen lists personal records", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-01-15T12:00:00"));
  await page.addInitScript(() => {
    // Three Dailies in a row, then a gap: the longest streak comes from the history.
    for (const day of ["2026-01-02", "2026-01-03", "2026-01-04", "2026-01-14"]) {
      localStorage.setItem(
        `sudoku_v1_daily_${day}`,
        JSON.stringify({ completed: true, time: 500, mistakes: 0 }),
      );
    }
    localStorage.setItem(
      "sudoku_v1_score",
      JSON.stringify({ total: 900, gamesWon: 6, best: {}, perDifficulty: {} }),
    );
    localStorage.setItem(
      "sudoku_v1_records",
      JSON.stringify({
        day: "2026-01-14",
        dayWins: 1,
        mostInDay: 4,
        cleanRun: 0,
        bestCleanRun: 5,
        hardestNoHint: "hard",
      }),
    );
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Statistics" }).click();

  const records = page.getByTestId("records");
  await expect(records.getByRole("heading", { name: "Records" })).toBeVisible();
  const row = (name: string) => records.locator("div", { hasText: name });
  await expect(row("Longest Daily streak").locator("dd")).toHaveText("3");
  await expect(row("Most wins in one day").locator("dd")).toHaveText("4");
  await expect(row("Most wins in a row without a mistake").locator("dd")).toHaveText("5");
  await expect(row("Hardest level won without hints").locator("dd")).toHaveText("Hard");
});
