import { test, expect } from "@playwright/test";

import { BOARD, blank, playCustom } from "./seed";

test("with mistakes hidden, a hint points at a wrong entry and clears it", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sudoku_v1_pref_highlight_errors", "false"));
  await page.goto("/");
  // R5C5 (a 5) and R6C6 (a 4) are blank.
  await playCustom(page, blank(40, 50));

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
