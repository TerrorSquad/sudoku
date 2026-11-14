import { test, expect } from "@playwright/test";

const BOARD = ".grid.aspect-square.w-full.grid-cols-9";
const SOLVED = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

test("with mistakes hidden, a hint points at a wrong entry and clears it", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sudoku_v1_pref_highlight_errors", "false"));
  await page.goto("/");
  await page.getByRole("button", { name: "Your puzzle" }).click();
  // R5C5 (a 5) and R6C6 (a 4) are blank.
  const puzzle = [...SOLVED].map((d, i) => (i === 40 || i === 50 ? "0" : d)).join("");
  await page.locator("textarea").fill(puzzle);
  await page.getByRole("button", { name: "Play Puzzle" }).click();

  const cell = page.locator(`${BOARD} [data-cell="4-4"]`);
  await cell.click();
  await page.keyboard.press("1"); // wrong, and left unmarked
  await expect(cell).toHaveAttribute("aria-label", /your entry 1/);

  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Wrong digit" })).toBeVisible();
  await expect(page.getByText("The 1 at R5C5 is wrong.")).toBeVisible();
  await expect(page.getByText("The wrong digit", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();

  await expect(cell).toHaveAttribute("aria-label", /empty$/);
});
