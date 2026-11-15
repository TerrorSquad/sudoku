import { test, expect } from "@playwright/test";

test("the stats heat-map marks completed Daily days", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-01-15T12:00:00"));
  await page.addInitScript(() => {
    for (const day of ["2026-01-14", "2026-01-13", "2025-12-30"]) {
      localStorage.setItem(
        `sudoku_v1_daily_${day}`,
        JSON.stringify({ completed: true, time: 500, mistakes: 0 }),
      );
    }
    // The calendar only shows once there is something to show.
    localStorage.setItem(
      "sudoku_v1_score",
      JSON.stringify({ total: 100, gamesWon: 1, best: {}, perDifficulty: {} }),
    );
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Statistics" }).click();

  await expect(page.getByText("3 days completed in the last 12 weeks").first()).toBeVisible();
  await expect(page.locator('[data-done="true"]')).toHaveCount(3);
  await expect(page.locator('[title="2026-01-14"]')).toHaveAttribute("data-done", "true");
  await expect(page.locator('[title="2026-01-15"]')).toHaveAttribute("data-done", "false");
});

test("a streak freeze covers a missed day and keeps the streak", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-01-15T12:00:00"));
  await page.addInitScript(() => {
    // Seven in a row earn a freeze; the 12th is missed; the 13th and 14th carry the streak on.
    const days = ["05", "06", "07", "08", "09", "10", "11", "13", "14"].map((d) => `2026-01-${d}`);
    for (const day of days)
      localStorage.setItem(
        `sudoku_v1_daily_${day}`,
        JSON.stringify({ completed: true, time: 500, mistakes: 0 }),
      );
    localStorage.setItem(
      "sudoku_v1_score",
      JSON.stringify({ total: 100, gamesWon: 9, best: {}, perDifficulty: {} }),
    );
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /9-day streak/ })).toBeVisible();
  await page.getByRole("button", { name: "Statistics" }).click();
  await expect(page.locator('[data-frozen="true"]')).toHaveCount(1);
  await expect(page.locator('[data-frozen="true"]')).toHaveAttribute(
    "title",
    "2026-01-12 · streak freeze",
  );
  await expect(page.getByTestId("freezes")).toHaveText("❄ 0/2 streak freezes");
});
