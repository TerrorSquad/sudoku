/* oxlint-disable eslint/no-await-in-loop -- browser steps are inherently sequential */
import { test, expect } from "@playwright/test";

import { resumeMedium, seedMediumSave } from "./seed";

// Its first hint is a pointing pair on 2 (see sudokuEngine.test.ts).
const POINTING =
  "936850010072630598500000036000003689803069040600080153700046325360005874245378961";
const overlay = (page: import("@playwright/test").Page) =>
  page.locator(".board [data-testid=pattern-overlay]");

test("a hint draws its pattern in pen, and applying it strikes the marks through", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Your puzzle" }).click();
  await page.locator("textarea").fill(POINTING);
  await page.getByRole("button", { name: "Play Puzzle" }).click();
  await page.getByRole("button", { name: "Hint", exact: true }).click();

  // Walk the steps until the pattern shows: a box frame, a line through the pair, rings.
  const next = page.getByRole("button", { name: /^(Next|Apply)$/ });
  while (!(await overlay(page).count())) await next.first().click();
  await expect(overlay(page).locator(".pm-frame")).toHaveCount(1);
  await expect(overlay(page).locator(".pm-ring")).not.toHaveCount(0);
  // What it removes only shows on the step that says so.
  while (!(await overlay(page).locator(".pm-cross").count())) await next.first().click();

  await page.getByRole("button", { name: "Apply" }).click();
  // The removed marks linger in red under a stroke, then the board is clean again.
  await expect(overlay(page).locator(".pm-ghost")).not.toHaveCount(0);
  await expect(overlay(page)).toHaveCount(0, { timeout: 3000 });
});

test("a hint that wins the game leaves no pen marks on the next board", async ({ page }) => {
  // One blank left: the hint's placement wins, and its pen circle must not outlive the board.
  await seedMediumSave(page, [49]);
  await resumeMedium(page);
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  const next = page.getByRole("button", { name: /^(Next|Apply)$/ });
  while (await next.count()) await next.first().click();
  await page.getByTestId("next-puzzle").click();
  await expect(page.getByTestId("next-puzzle")).toHaveCount(0);
  await expect(page.locator(".board [data-cell]")).toHaveCount(81);
  await expect(overlay(page)).toHaveCount(0);
});

test("a lesson draws the pattern once it's found, and Replay draws the move again", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Academy/ }).click();
  await page
    .locator("#lesson-pointing")
    .getByRole("button", { name: "Learn it step by step" })
    .click();
  const coach = page.getByTestId("coach");
  await expect(coach).toContainText("Step 1 of 2", { timeout: 30_000 });
  await expect(overlay(page)).toHaveCount(0); // finding it is the player's job
  const digit = /Pointing Pair on (\d)/.exec((await coach.textContent()) ?? "")![1]!;

  const show = coach.getByRole("button", { name: "Show me" });
  await show.click(); // the digit
  await show.click(); // the box it works in
  await expect(overlay(page)).toHaveCount(0);
  await show.click(); // the pattern itself
  await expect(coach).toContainText("Step 2 of 2");
  await expect(overlay(page).locator(".pm-strong")).not.toHaveCount(0);
  await expect(overlay(page).locator(".pm-cross")).toHaveCount(0); // not the answer yet

  await show.click();
  const ids = await page
    .locator('.board [data-cell][class*="bg-rose-500/30"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-cell")));
  await page.locator(`.board [data-cell="${ids[0]}"]`).click();
  await page.keyboard.press(digit);
  // The crossed-out mark lingers in red (unless that was the only one and the lesson is done).
  if (ids.length > 1) await expect(overlay(page).locator(".pm-ghost")).toHaveCount(1);
  for (const id of ids.slice(1)) {
    await page.locator(`.board [data-cell="${id}"]`).click();
    await page.keyboard.press(digit);
  }

  await expect(coach).toContainText("Well done!");
  await expect(overlay(page).locator(".pm-cross")).toHaveCount(ids.length);
  const before = await overlay(page).elementHandle();
  await page.getByRole("button", { name: "Replay the move" }).click();
  // Replay redraws from scratch: a fresh SVG.
  await expect.poll(async () => (await overlay(page).elementHandle()) !== before).toBe(true);
});

test("the Academy's worked example is drawn in pen", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Academy/ }).click();
  const card = page.locator("#lesson-x-wing");
  await card.click({ position: { x: 20, y: 20 } });
  await expect(card.getByTestId("pattern-overlay").locator(".pm-strong")).toHaveCount(2);
  await expect(card.getByTestId("pattern-overlay").locator(".pm-weak")).toHaveCount(2);
});
