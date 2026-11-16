/* oxlint-disable eslint/no-await-in-loop -- key presses are inherently sequential */
import { test, expect, type Page } from "@playwright/test";

import { BOARD } from "./seed";

// Each cell's pencil marks, read off its label ("Row 1, column 2, empty, notes 3, 7").
async function notesOf(page: Page) {
  const labels = await page
    .locator(`${BOARD} [data-cell]`)
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
  return labels.map((l) => (/notes (.*)$/.exec(l)?.[1] ?? "").split(", ").filter(Boolean));
}

/** A naked-single lesson's answer: the one cell in the named unit down to one mark. */
async function nakedSingle(page: Page) {
  const coach = page.getByTestId("coach");
  const [, kind, n] = /in (row|column|box) (\d)/.exec((await coach.textContent()) ?? "")!;
  const inUnit = (i: number) => {
    const [r, c, k] = [Math.floor(i / 9), i % 9, Number(n) - 1];
    if (kind === "row") return r === k;
    if (kind === "column") return c === k;
    return Math.floor(r / 3) * 3 + Math.floor(c / 3) === k;
  };
  const notes = await notesOf(page);
  const at = notes.findIndex((ns, i) => inUnit(i) && ns.length === 1);
  return { at, digit: notes[at]![0]!, given: notes.findIndex((ns) => ns.length === 0) };
}

const boardLabels = (page: Page) =>
  page
    .locator(`${BOARD} [data-cell]`)
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));

test("a lesson by keyboard alone: 3 stars on the card, and N goes on to the next lesson", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Academy/ }).click();
  await page.getByRole("button", { name: "Next challenge: Naked Single" }).click();
  const coach = page.getByTestId("coach");
  await expect(coach).toContainText("Step 1 of 2", { timeout: 30_000 });
  await expect(page.getByTestId("lesson-keys")).toContainText("Show me");

  // WASD from the top-left corner to the cell, Enter taps it, then its digit.
  const { at, digit } = await nakedSingle(page);
  await page.keyboard.press("s"); // nothing selected yet → top-left
  for (let i = 0; i < Math.floor(at / 9); i++) await page.keyboard.press("s");
  for (let i = 0; i < at % 9; i++) await page.keyboard.press("d");
  await page.keyboard.press("Enter");
  await expect(coach).toContainText("Step 2 of 2");
  await page.keyboard.press(digit);

  await expect(coach).toContainText("Well done!");
  await expect(page.getByTestId("lesson-stars").getByRole("img")).toHaveAccessibleName(
    "3 of 3 stars",
  );
  await expect(coach.getByRole("button", { name: "Next lesson: Hidden Single" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("sudoku_v1_lesson_stars"))).toBe(
    '{"naked-single":3}',
  );

  await page.keyboard.press("n");
  await expect(page.getByRole("heading", { name: "Lesson: Hidden Single" })).toBeVisible({
    timeout: 30_000,
  });
  await page.keyboard.press("Escape");
  const card = page.locator("#lesson-naked-single");
  await expect(card.getByTestId("card-stars")).toHaveAccessibleName("3 of 3 stars");
  // A flawless lesson counts as practised, even with no hints yet.
  await expect(card).toContainText("Practised");
});

test("a wrong tap says why, Show me (H) walks to step 2, and R deals another example", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Academy/ }).click();
  await page
    .locator("#lesson-naked-single")
    .getByRole("button", { name: "Learn it step by step" })
    .click();
  const coach = page.getByTestId("coach");
  const status = coach.getByRole("status");
  await expect(coach).toContainText("Step 1 of 2", { timeout: 30_000 });

  const { at, digit, given } = await nakedSingle(page);
  const cells = page.locator(`${BOARD} [data-cell]`);
  await cells.nth(given).click();
  await expect(status).toHaveText("That cell is already filled.");

  // A naked single has no one digit to show, so Show me starts at the box, then the cell.
  await page.keyboard.press("h");
  await expect(status).toHaveText("It's in the highlighted rows, columns or box.");
  await page.keyboard.press("h");
  await expect(coach).toContainText("Step 2 of 2");
  await cells.nth(at).click();
  await page.keyboard.press(digit);

  await expect(coach).toContainText("Well done!");
  await expect(page.getByTestId("lesson-stars").getByRole("img")).toHaveAccessibleName(
    "1 of 3 stars",
  );

  const before = await boardLabels(page);
  await page.keyboard.press("r");
  await expect(coach).toContainText("Step 1 of 2", { timeout: 30_000 });
  expect(await boardLabels(page)).not.toEqual(before);
  await expect(page.getByRole("heading", { name: "Lesson: Naked Single" })).toBeVisible();
});
