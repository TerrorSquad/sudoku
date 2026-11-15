/* oxlint-disable eslint/no-await-in-loop -- browser steps are inherently sequential */
import { test, expect, type Page } from "@playwright/test";

import { solveBoard } from "../app/utils/sudokuCore";

const BOARD = ".grid.aspect-square.w-full.grid-cols-9";

// Each cell's pencil marks, read off its label ("Row 1, column 2, empty, notes 3, 7").
async function notesOf(page: Page) {
  const labels = await page
    .locator(`${BOARD} [data-cell]`)
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
  return labels.map((l) => (/notes (.*)$/.exec(l)?.[1] ?? "").split(", ").filter(Boolean));
}

test("the next challenge's lesson: find the cell, place the digit, and the path moves on", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Academy/ })).toContainText("Path 0/22");
  await page.getByRole("button", { name: /Academy/ }).click();

  const path = page.getByTestId("technique-path");
  await expect(path).toContainText("0/22 challenges");
  await path.getByRole("button", { name: "Next challenge: Naked Single" }).click();
  const coach = page.getByTestId("coach");
  await expect(coach).toContainText("Step 1 of 2", { timeout: 30_000 });

  // The prompt names the unit; in it, exactly one cell is down to one pencil mark.
  const [, kind, n] = /in (row|column|box) (\d)/.exec((await coach.textContent()) ?? "")!;
  const inUnit = (i: number) => {
    const [r, c, k] = [Math.floor(i / 9), i % 9, Number(n) - 1];
    if (kind === "row") return r === k;
    if (kind === "column") return c === k;
    return Math.floor(r / 3) * 3 + Math.floor(c / 3) === k;
  };
  const notes = await notesOf(page);
  const target = notes.findIndex((ns, i) => inUnit(i) && ns.length === 1);
  const given = notes.findIndex((ns) => ns.length === 0);
  const cells = page.locator(`${BOARD} [data-cell]`);

  await cells.nth(given).click();
  await expect(coach.getByRole("status")).toHaveText("Not that cell. Look again.");
  await cells.nth(target).click();
  await expect(coach).toContainText("Step 2 of 2");
  await page.keyboard.press(notes[target]![0]!);

  await expect(coach).toContainText("Well done!");
  await expect(coach).toContainText("Challenge complete: Naked Single");
  await coach.getByRole("button", { name: "Back to Academy" }).click();
  await expect(path).toContainText("1/22 challenges");
  await expect(path.getByRole("button", { name: "Next challenge: Hidden Single" })).toBeVisible();
  await expect(page.locator("#lesson-naked-single")).toHaveAttribute("data-path", "done");
  await expect(page.locator("#lesson-hidden-single")).toHaveAttribute("data-path", "next");
  await expect(page.locator("#lesson-pointing")).toHaveAttribute("data-path", "locked");
  // The path is stored under the backed-up, cloud-synced prefix.
  expect(await page.evaluate(() => localStorage.getItem("sudoku_v1_technique_path"))).toBe(
    '["naked-single"]',
  );
});

test("Show me walks an elimination lesson through; only the ruled-out marks can go", async ({
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
  const digit = /Pointing Pair on (\d)/.exec((await coach.textContent()) ?? "")![1]!;

  const show = coach.getByRole("button", { name: "Show me" });
  await show.click(); // where to look
  await expect(coach).toContainText("Step 1 of 2");
  await show.click(); // the pattern itself
  await expect(coach).toContainText("Step 2 of 2");
  await expect(coach.getByRole("status")).toHaveText("Here's the pattern. Now use it.");
  await show.click(); // the cells to change
  const toClear = page.locator(`${BOARD} [data-cell][class*="bg-rose-500/30"]`);
  const count = await toClear.count();
  expect(count).toBeGreaterThan(0);

  // A mark the pattern doesn't rule out stays put.
  const notes = await notesOf(page);
  const keep = notes.findIndex((ns) => ns.includes(digit === "1" ? "2" : "1"));
  const cells = page.locator(`${BOARD} [data-cell]`);
  await cells.nth(keep).click();
  await page.keyboard.press(digit === "1" ? "2" : "1");
  await expect(coach.getByRole("status")).not.toHaveText(/Crossed out/);

  const ids = await toClear.evaluateAll((els) => els.map((e) => e.getAttribute("data-cell")));
  for (const id of ids) {
    await page.locator(`${BOARD} [data-cell="${id}"]`).click();
    await page.keyboard.press(digit);
  }
  await expect(coach).toContainText("Well done!");
  // Not the next challenge, so the path doesn't move.
  await expect(coach).not.toContainText("Challenge complete");
});

test("a full practice win is extra practice: it doesn't complete the challenge", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Academy/ }).click();
  await page
    .locator("#lesson-naked-single")
    .getByRole("button", { name: "Practice a full puzzle" })
    .click();
  await expect(page.getByText("Practice · Naked Single")).toBeVisible({ timeout: 30_000 });

  // Read the givens off the cells' labels, solve, and type the rest in.
  const cells = page.locator(`${BOARD} [data-cell]`);
  await expect(cells).toHaveCount(81);
  const labels = await cells.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  const board = Array.from({ length: 9 }, (_, r) =>
    labels.slice(r * 9, r * 9 + 9).map((l) => Number(/given (\d)/.exec(l ?? "")?.[1] ?? 0)),
  );
  const solved = solveBoard(board)!;
  for (let i = 0; i < 81; i++) {
    const [r, c] = [Math.floor(i / 9), i % 9];
    if (board[r]![c]) continue;
    await cells.nth(i).click();
    await page.keyboard.press(String(solved[r]![c]));
  }

  await expect(page.getByText("Full puzzles are extra practice.")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("button", { name: /Academy/ })).toContainText("Path 0/22");
});

test("the technique of the week starts the same seeded puzzle each time", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Academy/ }).click();
  const weekly = page.getByTestId("technique-of-week");
  const name = (await weekly.locator("p").first().textContent())!.trim();

  const givens = async () => {
    await weekly.getByRole("button", { name: "Play this week's puzzle" }).click();
    await expect(page.getByText(`Technique of the week · ${name}`)).toBeVisible({
      timeout: 30_000,
    });
    const labels = await page
      .locator(`${BOARD} [data-cell]`)
      .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    await page.getByLabel("Exit").click();
    await page.getByRole("button", { name: /Academy/ }).click();
    return labels;
  };
  expect(await givens()).toEqual(await givens());
});
