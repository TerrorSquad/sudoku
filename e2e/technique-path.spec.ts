/* oxlint-disable eslint/no-await-in-loop -- browser steps are inherently sequential */
import { test, expect } from "@playwright/test";

import { solveBoard } from "../app/utils/sudokuCore";

const BOARD = ".grid.aspect-square.w-full.grid-cols-9";

test("winning the next challenge's practice puzzle moves the technique path on", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Academy/ })).toContainText("Path 0/22");
  await page.getByRole("button", { name: /Academy/ }).click();

  const path = page.getByTestId("technique-path");
  await expect(path).toContainText("0/22 challenges");
  await path.getByRole("button", { name: "Next challenge: Naked Single" }).click();
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

  await expect(page.getByText("Challenge complete: Naked Single")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("button", { name: /Academy/ })).toContainText("Path 1/22");

  await page.getByRole("button", { name: /Academy/ }).click();
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
