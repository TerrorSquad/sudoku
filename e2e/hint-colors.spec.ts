import { test, expect } from "@playwright/test";

// A solved grid with the first five cells of row 1 blanked (answers 5 3 4 6 7).
const FIVE_BLANKS =
  "000008912672195348198342567859761423426853791713924856961537284287419635345286179";

test("a placement hint marks its target green, not as the yellow selection", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Your puzzle" }).click();
  await page.locator("textarea").fill(FIVE_BLANKS);
  await page.getByRole("button", { name: "Play Puzzle" }).click();
  await page.locator('[data-cell="4-4"]').click();
  await page.getByRole("button", { name: "Hint" }).first().click();

  await expect(page.locator(".ring-emerald-500[data-cell]")).toHaveCount(1);
  await expect(page.locator('[data-cell][aria-selected="true"]')).toHaveCount(0);
  await expect(page.getByText("Target cell")).toBeVisible();
  await expect(page.getByText("Candidates to remove")).toBeHidden();
  // Below the general description, this move on this board, by its real row and column.
  await expect(page.getByTestId("hint-detail")).toContainText(/row 1, column [1-5]\b/);
});

test("the idle hint panel names what applies on the board, and steps aside for a hint", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Your puzzle" }).click();
  await page.locator("textarea").fill(FIVE_BLANKS);
  await page.getByRole("button", { name: "Play Puzzle" }).click();
  const list = page.getByTestId("board-techniques");
  await expect(list.getByRole("listitem")).toHaveText(["Naked Single", "Hidden Single"]);
  await page.getByRole("button", { name: "Hint" }).first().click();
  await expect(list).toBeHidden();
});
