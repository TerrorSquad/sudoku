/* oxlint-disable eslint/no-await-in-loop -- browser steps are inherently sequential */
import { test, expect } from "@playwright/test";

import { lessonFromPuzzle, quickLesson } from "../app/utils/lesson";
import { generatePracticePuzzle } from "../app/utils/practice";
import { stuckPosition } from "../app/utils/review";
import { getGridCandidates, makeRng } from "../app/utils/sudokuCore";

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

test("Daily review: a technique hinted in a game comes up on that game's position", async ({
  page,
}) => {
  // The position a game would hint the x-wing at: its board and the removals made before it.
  const puzzle = await generatePracticePuzzle("x-wing", makeRng(11));
  const L = lessonFromPuzzle(puzzle.board, "x-wing")!;
  const cands = getGridCandidates(L.board);
  const elims = L.board.flatMap((row, r) =>
    row.flatMap((_, c) =>
      cands[r]![c]!.filter((n) => !L.notes[r]![c]!.includes(n)).map((num) => ({ r, c, num })),
    ),
  );
  const own = { "x-wing": stuckPosition(L.board, elims, "2026-11-13") };
  await page.clock.setFixedTime(new Date("2026-11-15T12:00:00"));
  await page.addInitScript((positions) => {
    (window as { spotSeed?: number }).spotSeed = 7;
    localStorage.setItem(
      "sudoku_v1_review",
      JSON.stringify({ "x-wing": { box: 1, next: "2026-11-14" } }),
    );
    localStorage.setItem("sudoku_v1_review_positions", JSON.stringify(positions));
  }, own);
  await page.goto("/");

  await page.getByRole("button", { name: /^Academy/ }).click();
  await page.getByTestId("review-panel").getByRole("button", { name: "Review (1)" }).click();
  await expect(page.getByTestId("spot-progress")).toContainText("Position 1 of 1 · X-Wing");
  await expect(page.getByTestId("review-own")).toHaveText("From your game on Fri, Nov 13");
  // The board is the game's, digit for digit.
  const shown = await page.evaluate(() =>
    Array.from({ length: 81 }, (_, i) => {
      const cell = document.querySelector(`[data-cell="${Math.floor(i / 9)}-${i % 9}"]`);
      return cell?.querySelector(":scope > span")?.textContent?.trim() || "0";
    }).join(""),
  );
  expect(shown).toBe(own["x-wing"].board);

  for (const { r, c } of L.pattern) await page.locator(`[data-cell="${r}-${c}"]`).click();
  await expect(page.getByTestId("spot-coach").getByRole("status")).toHaveText("Found it!");
  // Played: the next review of it gets a fresh position.
  await expect(page.getByTestId("review-done")).toBeVisible();
  const left = await page.evaluate(() => localStorage.getItem("sudoku_v1_review_positions"));
  expect(JSON.parse(left!)).toEqual({});
});
