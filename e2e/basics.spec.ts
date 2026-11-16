import { test, expect } from "@playwright/test";

const status = (page: import("@playwright/test").Page) =>
  page.getByTestId("coach").getByRole("status");

test("a fresh player is offered How to play, and does the first two lessons by keyboard", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /New to sudoku\?/ }).click();
  await expect(page.getByRole("heading", { name: "How to play: The rule" })).toBeVisible();

  // Row 5 is missing a 7; its empty cell starts selected. A 4 is already there.
  await page.keyboard.press("4");
  await expect(status(page)).toHaveText("This row already has 4.");
  await page.keyboard.press("7");
  await expect(status(page)).toHaveText("Right! Next one.");
  await page.keyboard.press("1"); // the column
  await page.keyboard.press("3"); // the box
  await expect(page.getByTestId("coach").getByText("Well done!")).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "How to play: Pencil marks" })).toBeVisible();
  await page.keyboard.press("5");
  await expect(status(page)).toContainText("Turn on Notes first");
  await page.keyboard.press("n");
  await expect(page.getByTestId("basics-notes")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("4");
  await expect(status(page)).toHaveText("This row already has 4.");
  await page.keyboard.press("1");
  await expect(status(page)).toHaveText("Yes, 1 could go here. Any more?");
  await page.keyboard.press("5");
  await page.keyboard.press("9");
  await expect(status(page)).toContainText("That's all of them: 1, 5, 9.");
  await expect(page.getByTestId("basics-next")).toHaveText("Next: One mark left");

  // The Academy counts them as step 0, and the menu stops offering the course.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("basics")).toContainText("2/4 lessons");
  await page.getByRole("button", { name: "Back to Menu" }).click();
  await expect(page.getByTestId("basics-prompt")).toHaveCount(0);
});

test("scanning names the line that rules a cell out", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Academy" }).click();
  await page.getByTestId("basics").getByRole("button", { name: "Scanning" }).click();
  await page.locator('[data-cell="1-0"]').click();
  await page.keyboard.press("5");
  await expect(status(page)).toHaveText("Row 2 already has 5, so this cell is ruled out.");
  await page.locator('[data-cell="0-1"]').click();
  await page.keyboard.press("5");
  await expect(status(page)).toHaveText("Column 2 already has 5, so this cell is ruled out.");
  await page.locator('[data-cell="0-0"]').click();
  await page.keyboard.press("5");
  await expect(page.getByTestId("coach").getByText("Well done!")).toBeVisible();
  await expect(page.getByTestId("basics-next")).toHaveText("Start the technique path");
});

test("hiding the prompt sticks", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("basics-prompt").getByRole("button", { name: "Hide" }).click();
  await expect(page.getByTestId("basics-prompt")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "New Game" })).toBeVisible();
  await expect(page.getByTestId("basics-prompt")).toHaveCount(0);
});

test("after a lesson from a game and quitting it, the course's Back never returns to that game", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("sudoku_v1_pref_hint_style", '"nudge"'));
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Beginner/ }).click();
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Next step:" })
    .getByRole("button", { name: /Single|Pair|Wing|Triple|Quad/ })
    .click();
  await expect(page.getByRole("heading", { name: /^Lesson: / })).toBeVisible();
  await page.getByRole("button", { name: "Back to game" }).first().click();
  await page.getByRole("button", { name: "Resume" }).first().click();
  await page.getByRole("button", { name: "Exit" }).click();

  // The lesson isn't finished, so the course is still offered.
  await page.getByRole("button", { name: /New to sudoku\?/ }).click();
  await page.getByRole("button", { name: "Back to Academy" }).first().click();
  await expect(page.getByTestId("basics")).toBeVisible();
  // Its header says Menu, not Back to game, and goes there.
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("button", { name: "New Game" })).toBeVisible();
});

test("the box exercise names the box, not the row", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /New to sudoku\?/ }).click();
  await expect(page.getByRole("heading", { name: "How to play: The rule" })).toBeVisible();
  await page.keyboard.press("7");
  await expect(status(page)).toHaveText("Right! Next one.");
  await page.keyboard.press("1");
  await expect(page.getByTestId("coach")).toContainText("task 3 of 3");
  // The box's empty cell shares its row with a 6 that is also inside the box.
  await page.keyboard.press("6");
  await expect(status(page)).toHaveText("This box already has 6.");
});
