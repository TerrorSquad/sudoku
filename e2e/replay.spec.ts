import { test, expect, type Page } from "@playwright/test";

import { place, resumeMedium, seedMediumSave, stuckSave } from "./seed";

// "Watch your solve": the win modal replays the game's placements, stuck moments marked.
async function winStuckGame(page: Page) {
  await page.addInitScript((save) => {
    if (!localStorage.getItem("e2e_seeded")) {
      localStorage.setItem("e2e_seeded", "1");
      localStorage.setItem("sudoku_v1_save_medium", JSON.stringify(save));
    }
  }, stuckSave());
  await resumeMedium(page);
  await place(page, 73, "4");
  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeVisible();
  await page.getByTestId("watch-solve").click();
  await expect(page.getByTestId("solve-replay")).toBeVisible();
}

const stepText = (page: Page) => page.getByTestId("replay-step");

test("the replay steps through the moves and names what would have broken the stuck moment", async ({
  page,
}) => {
  await winStuckGame(page);
  await expect(stepText(page)).toHaveText("The givens");
  // It plays on the game's own board: the givens alone, the modal out of the way.
  const board = page.getByTestId("replay-board");
  await expect(board.locator('[data-cell][aria-label$="empty"]')).toHaveCount(18);
  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeHidden();
  await page.getByRole("button", { name: "Step forward" }).click();
  await expect(stepText(page)).toHaveText("Move 1 of 18 · 00:05");
  await page.keyboard.press("ArrowRight");
  await expect(stepText(page)).toHaveText("Move 2 of 18 · 00:10");
  await page.keyboard.press("ArrowLeft");
  await expect(stepText(page)).toHaveText("Move 1 of 18 · 00:05");
  await expect(page.getByTestId("replay-stuck")).toBeEmpty();

  // The marker jumps to the board the player stared at: ten moves in, at 0:50.
  await page.getByRole("button", { name: "Stuck at 00:50" }).click();
  await expect(stepText(page)).toHaveText("Move 10 of 18 · 00:50");
  const stuck = page.getByTestId("replay-stuck");
  await expect(stuck).toContainText("00:50 · 01:30 to the next digit");

  // Esc closes the replay, not the win modal.
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("solve-replay")).toBeHidden();
  await expect(board).toBeHidden();
  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeVisible();

  // The technique opens its lesson.
  await page.getByTestId("watch-solve").click();
  await page.getByRole("button", { name: "Stuck at 00:50" }).click();
  await stuck.getByRole("button").click();
  await expect(page.getByRole("heading", { name: /^Lesson: / })).toBeVisible();
});

test("Play runs the moves on and rests on the stuck moment", async ({ page }) => {
  await winStuckGame(page);
  const speed = page.getByRole("button", { name: /^Speed/ });
  await speed.click();
  await speed.click();
  await expect(speed).toHaveText("4×");
  await page.getByRole("button", { name: "Play" }).click();
  await expect(stepText(page)).toHaveText("Move 10 of 18 · 00:50");
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible(); // stopped there
  await page.waitForTimeout(400);
  await expect(stepText(page)).toHaveText("Move 10 of 18 · 00:50");
});

test("with reduced motion there's no autoplay: Space steps", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await winStuckGame(page);
  await expect(page.getByRole("button", { name: "Play" })).toHaveCount(0);
  await page.getByTestId("solve-replay").focus();
  await page.keyboard.press(" ");
  await expect(stepText(page)).toHaveText("Move 1 of 18 · 00:05");
});

test("a digit brought back by redo is in the replay, which ends on the solution", async ({
  page,
}) => {
  await seedMediumSave(page, [49, 50]); // a 2 and a 4
  await resumeMedium(page);
  await place(page, 49, "2");
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+Shift+z");
  await place(page, 50, "4");
  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeVisible();
  await page.getByTestId("watch-solve").click();
  await page.getByRole("button", { name: "Step forward" }).click();
  await page.getByRole("button", { name: "Step forward" }).click();
  await expect(stepText(page)).toContainText("Move 2 of 2");
  const replay = page.getByTestId("replay-board");
  await expect(replay.locator('[data-cell][aria-label$="empty"]')).toHaveCount(0);
});

test("a digit brought back through the move history is in the replay too", async ({ page }) => {
  await seedMediumSave(page, [49, 50]); // a 2 and a 4
  await resumeMedium(page);
  await place(page, 49, "2");
  await page.keyboard.press("Shift+Z");
  const slider = page.getByRole("slider", { name: "Move history" });
  await slider.press("Home");
  await slider.press("End");
  await page.keyboard.press("Escape");
  await place(page, 50, "4");
  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeVisible();
  await page.getByTestId("watch-solve").click();
  const replay = page.getByTestId("replay-board");
  await page.getByRole("button", { name: "Step forward" }).click();
  await page.getByRole("button", { name: "Step forward" }).click();
  await expect(stepText(page)).toContainText("Move 2 of 2");
  await expect(replay.locator('[data-cell][aria-label$="empty"]')).toHaveCount(0);
});

test("See it in 3D opens the skyline over the replay, and closes back to it", async ({ page }) => {
  await winStuckGame(page);
  await page.getByTestId("open-skyline").click();
  await expect(page.getByTestId("solve-skyline")).toBeVisible();
  await expect(page.getByTestId("skyline-save")).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("solve-skyline")).toBeHidden();
  await expect(page.getByTestId("solve-replay")).toBeVisible();
});
