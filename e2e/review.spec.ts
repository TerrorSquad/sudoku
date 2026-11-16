/* oxlint-disable eslint/no-await-in-loop -- browser steps are inherently sequential */
import { test, expect } from "@playwright/test";

import { quickLesson } from "../app/utils/lesson";
import { makeRng } from "../app/utils/sudokuCore";

// The session the app builds from window.spotSeed: one position per due technique, longest
// overdue first, each seeded from the same rng. Rebuilt here so the test knows the answers.
const SEED = 7;
const DUE = ["naked-single", "hidden-single"] as const;

test("Daily review: due techniques on the menu, a pass moves up, a skip goes back", async ({
  page,
}) => {
  const rng = makeRng(SEED);
  const lessons = await Promise.all(
    DUE.map((id) => quickLesson(id, makeRng(Math.floor(rng() * 2 ** 31)))),
  );
  await page.clock.setFixedTime(new Date("2026-11-15T12:00:00"));
  await page.addInitScript((seed) => {
    (window as { spotSeed?: number }).spotSeed = seed;
    localStorage.setItem(
      "sudoku_v1_technique_path",
      JSON.stringify(["naked-single", "hidden-single", "pointing"]),
    );
    localStorage.setItem(
      "sudoku_v1_review",
      JSON.stringify({
        "naked-single": { box: 2, next: "2026-11-10" },
        "hidden-single": { box: 1, next: "2026-11-14" },
        pointing: { box: 3, next: "2026-11-30" },
      }),
    );
  }, SEED);
  await page.goto("/");

  await expect(page.getByTestId("review-badge")).toHaveText("· Review: 2");
  await page.getByRole("button", { name: /^Academy/ }).click();
  const panel = page.getByTestId("review-panel");
  await expect(panel.getByTestId("review-status")).toContainText("Due today: 2.");
  await panel.getByRole("button", { name: "Review (2)" }).click();

  const status = page.getByTestId("spot-coach").getByRole("status");
  // No clock in a review: it's about remembering, not speed.
  await expect(page.getByTestId("spot-clock")).toHaveCount(0);
  await expect(page.getByTestId("spot-progress")).toContainText("Position 1 of 2 · Naked Single");
  for (const { r, c } of lessons[0]!.pattern) await page.locator(`[data-cell="${r}-${c}"]`).click();
  await expect(status).toHaveText("Found it!");
  await expect(page.getByTestId("spot-progress")).toContainText("Position 2 of 2 · Hidden Single");
  await page.keyboard.press("h");
  await expect(status).toHaveText("Here it is. It will come up again soon.");

  const done = page.getByTestId("review-done");
  await expect(done).toBeVisible();
  const passed = done.locator('[data-passed="true"]');
  const missed = done.locator('[data-passed="false"]');
  await expect(passed).toContainText("Naked Single");
  await expect(passed).toContainText("Moved up: step 3 of 5");
  await expect(missed).toContainText("Back to step 1 · next review: tomorrow");
  await expect(missed.getByRole("button", { name: "Lesson" })).toBeVisible();

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("sudoku_v1_review")!));
  expect(stored).toEqual({
    "naked-single": { box: 3, next: "2026-11-22" },
    "hidden-single": { box: 1, next: "2026-11-16" },
    pointing: { box: 3, next: "2026-11-30" },
  });

  await done.getByRole("button", { name: "Back to Academy" }).click();
  await expect(panel.getByTestId("review-status")).toHaveText(
    "All caught up. Next review: tomorrow.",
  );
  await page.getByRole("button", { name: "Menu" }).first().click();
  await expect(page.getByTestId("review-badge")).toHaveCount(0);
});
