/* oxlint-disable eslint/no-await-in-loop -- the positions are played one after another */
import { test, expect } from "@playwright/test";

import { quickLesson } from "../app/utils/lesson";
import { buildRound } from "../app/utils/spotIt";
import { makeRng } from "../app/utils/sudokuCore";

// The round the app builds from window.spotSeed, rebuilt here so the test knows every answer.
const SEED = 1;

test("a Basic Spot it round: wrong taps and a skip add time, the best is kept", async ({
  page,
}) => {
  const slots = buildRound("Basic", makeRng(SEED));
  const lessons = await Promise.all(slots.map((s) => quickLesson(s.technique, makeRng(s.seed))));
  await page.addInitScript((seed) => ((window as { spotSeed?: number }).spotSeed = seed), SEED);
  await page.goto("/");
  await page.getByRole("button", { name: /^Academy/ }).click();
  await page.getByTestId("spot-it").getByRole("button", { name: /Basic/ }).click();

  const progress = page.getByTestId("spot-progress");
  const status = page.getByTestId("spot-coach").getByRole("status");
  for (const [i, L] of lessons.entries()) {
    await expect(progress).toContainText(`Position ${i + 1} of 10 ·`);
    if (i === 0) {
      // A filled cell is never part of a pattern: +5 s, and the position stays up.
      const filled = L.board
        .flatMap((row, r) => row.map((v, c) => ({ r, c, v })))
        .find((x) => x.v)!;
      await page.locator(`[data-cell="${filled.r}-${filled.c}"]`).click();
      await expect(status).toContainText("+5 s");
    }
    if (i === 1) {
      await page.keyboard.press("h");
      await expect(status).toContainText("Here it is (+15 s)");
      continue;
    }
    for (const { r, c } of L.pattern) await page.locator(`[data-cell="${r}-${c}"]`).click();
    await expect(status).toHaveText("Found it!");
  }

  const done = page.getByTestId("spot-done");
  await expect(done).toBeVisible();
  await expect(done.getByText("New best!")).toBeVisible();
  // The penalties alone: 5 s for the wrong tap, 15 s for the skip.
  const total = await page.getByTestId("spot-total").textContent();
  expect(Number.parseFloat(total!)).toBeGreaterThanOrEqual(20);
  // The skipped position's technique is flagged with its lesson.
  await expect(
    page.getByTestId("spot-breakdown").getByRole("button", { name: "Lesson" }).first(),
  ).toBeVisible();
  const best = await page.evaluate(() => localStorage.getItem("sudoku_v1_spot_best"));
  expect(JSON.parse(best!).Basic).toBeGreaterThanOrEqual(20);

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("spot-it").getByRole("button", { name: /Basic/ })).toContainText(
    "Best",
  );
});

test("a Basic Puzzle rush: a wrong tap and a skip each cost a life, the third ends it", async ({
  page,
}) => {
  const slots = buildRound("Basic", makeRng(SEED));
  const lessons = await Promise.all(
    slots.slice(0, 2).map((s) => quickLesson(s.technique, makeRng(s.seed))),
  );
  await page.addInitScript((seed) => ((window as { spotSeed?: number }).spotSeed = seed), SEED);
  await page.goto("/");
  await page.getByRole("button", { name: /^Academy/ }).click();
  await page.getByTestId("spot-rush").getByRole("button", { name: /Basic/ }).click();

  const lives = page.getByTestId("spot-lives");
  const progress = page.getByTestId("spot-progress");
  const status = page.getByTestId("spot-coach").getByRole("status");
  // The skip button is enabled only while a position is up.
  const skip = page.getByRole("button", { name: "Skip (costs a life)" });
  await expect(page.getByTestId("spot-clock")).toHaveCount(0);
  await expect(lives).toHaveAttribute("aria-label", "Lives left: 3 of 3");

  // 1: found.
  await expect(skip).toBeEnabled();
  for (const { r, c } of lessons[0]!.pattern) await page.locator(`[data-cell="${r}-${c}"]`).click();
  await expect(status).toHaveText("Found it!");

  // 2: a wrong tap (no time added), then a skip.
  await expect(progress).toContainText("Position 2 · found: 1");
  await expect(skip).toBeEnabled();
  const filled = lessons[1]!.board
    .flatMap((row, r) => row.map((v, c) => ({ r, c, v })))
    .find((x) => x.v)!;
  await page.locator(`[data-cell="${filled.r}-${filled.c}"]`).click();
  await expect(lives).toHaveAttribute("aria-label", "Lives left: 2 of 3");
  await expect(status).not.toContainText("+5 s");
  await page.keyboard.press("h");
  await expect(status).toHaveText("Here it is.");
  await expect(lives).toHaveAttribute("aria-label", "Lives left: 1 of 3");

  // 3: the last life.
  await expect(progress).toContainText("Position 3 · found: 1");
  await expect(skip).toBeEnabled();
  await page.keyboard.press("h");

  const done = page.getByTestId("spot-done");
  await expect(done).toBeVisible();
  await expect(done.getByText("Positions found")).toBeVisible();
  await expect(page.getByTestId("spot-total")).toHaveText("1");
  await expect(done.getByText("New best!")).toBeVisible();
  const best = await page.evaluate(() => localStorage.getItem("sudoku_v1_spot_rush"));
  expect(JSON.parse(best!)).toEqual({ Basic: 1 });

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("spot-rush").getByRole("button", { name: /Basic/ })).toContainText(
    "Best 1",
  );
  // The timed round's best is its own.
  await expect(page.getByTestId("spot-it").getByRole("button", { name: /Basic/ })).toContainText(
    "Not played yet",
  );
});
