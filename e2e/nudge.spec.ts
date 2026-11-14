import { test, expect } from "@playwright/test";

test("'Nudge first' names the technique and where to look, then explains on demand", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Hint style").selectOption("nudge");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Beginner/ }).click();
  await expect(page.locator("[data-cell]")).toHaveCount(81);

  const hint = page.getByRole("button", { name: "Hint", exact: true });
  await hint.click();
  const banner = page.getByRole("status").filter({ hasText: "Next step:" });
  await expect(banner).toContainText(/^Look at (row|column|box) [1-9]\. Next step: .+\./);
  // Exactly one row, column or box (9 cells) is outlined.
  await expect(page.locator("[data-cell].ring-amber-400\\/80")).toHaveCount(9);

  // The banner's button escalates to the full explanation and clears the nudge.
  await banner.getByRole("button", { name: "Explain it" }).click();
  await expect(banner).toBeHidden();
  await expect(page.locator("[data-cell].ring-amber-400\\/80")).toHaveCount(0);
});

test("with the default style the first press explains immediately", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Beginner/ }).click();
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await expect(page.getByText("Next step:")).toBeHidden();
});

test("any board change dismisses the nudge", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Hint style").selectOption("nudge");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Beginner/ }).click();
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await expect(page.getByText("Next step:")).toBeVisible();
  await page.getByRole("button", { name: "Notes", exact: true }).click(); // notes mode alone: still shown
  await expect(page.getByText("Next step:")).toBeVisible();
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  // Placing a digit changes the board, which dismisses the nudge.
  await page.locator('[data-cell][aria-label$="empty"]').first().click();
  await page.keyboard.press("1");
  await expect(page.getByText("Next step:")).toBeHidden();
});

test("the nudge's technique opens its lesson, and Back returns to the paused game", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("sudoku_v1_pref_hint_style", '"nudge"'));
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Beginner/ }).click();
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  const banner = page.getByRole("status").filter({ hasText: "Next step:" });
  const technique = banner.getByRole("button", { name: /Single|Pair|Wing|Triple|Quad/ });
  await technique.click();

  await expect(page.getByRole("heading", { name: "Sudoku Academy" })).toBeVisible();
  await expect(page.locator('[id^="lesson-"]:focus')).toBeInViewport();
  await page.getByRole("button", { name: "Back to Menu" }).click();
  await expect(page.getByText("Paused", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).first().click();
  await expect(page.locator("[data-cell]")).toHaveCount(81);
});

test("a nudge about a wrong entry names its box, not a technique", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("sudoku_v1_pref_hint_style", '"nudge"');
    localStorage.setItem("sudoku_v1_pref_highlight_errors", "false");
  });
  const solved = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
  await page.goto("/");
  await page.getByRole("button", { name: "Your puzzle" }).click();
  await page.locator("textarea").fill([...solved].map((d, i) => (i === 40 || i === 50 ? "0" : d)).join(""));
  await page.getByRole("button", { name: "Play Puzzle" }).click();
  await page.locator('[data-cell="4-4"]').click();
  await page.keyboard.press("1"); // wrong, and left unmarked

  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await expect(page.getByText("Look at box 5. One of your digits there is wrong.")).toBeVisible();
});
