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
