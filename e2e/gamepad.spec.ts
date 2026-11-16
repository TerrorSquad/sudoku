/* oxlint-disable eslint/no-await-in-loop -- button presses are inherently sequential */
import { test, expect, type Page } from "@playwright/test";

import { resumeMedium, seedMediumSave } from "./seed";

// A fake standard-mapping controller: tests flip its buttons; the app polls it each frame.
async function plugIn(page: Page) {
  await page.addInitScript(() => {
    const pad = {
      index: 0,
      connected: true,
      mapping: "standard",
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    (window as unknown as { pad: typeof pad }).pad = pad;
    navigator.getGamepads = () => [pad as unknown as Gamepad];
  });
}
async function press(page: Page, button: number, times = 1) {
  for (let i = 0; i < times; i++) {
    await page.evaluate((b) => {
      (window as unknown as { pad: { buttons: { pressed: boolean }[] } }).pad.buttons[b]!.pressed =
        true;
    }, button);
    await page.waitForTimeout(60);
    await page.evaluate((b) => {
      (window as unknown as { pad: { buttons: { pressed: boolean }[] } }).pad.buttons[b]!.pressed =
        false;
    }, button);
    await page.waitForTimeout(60);
  }
}
const [A, B, RB, DOWN, RIGHT] = [0, 1, 5, 13, 15];

test("a controller walks the board, picks a digit with RB and places it with A", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); // the win screen starts settled
  await plugIn(page);
  await seedMediumSave(page, [49]); // row 6, column 5 is a 2
  await resumeMedium(page);
  await page.evaluate(() => window.dispatchEvent(new Event("gamepadconnected")));
  const hud = page.getByTestId("pad-hud");
  await expect(hud).toContainText("1");

  await press(page, DOWN); // nothing selected yet: the top-left cell
  await press(page, DOWN, 5);
  await press(page, RIGHT, 4);
  await expect(page.locator('[data-cell="5-4"]')).toHaveAttribute("aria-selected", "true");
  await press(page, RB);
  await expect(hud).toContainText("2");
  await press(page, A);
  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeVisible();

  // On the end screen the D-pad moves focus between its buttons, and A presses one.
  await press(page, DOWN);
  await expect(page.locator("[data-end-modal] button:focus")).toHaveCount(1);
  // B closes it, even with one of its buttons focused.
  await press(page, B);
  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeHidden();
  await expect(page.getByRole("button", { name: "New Game" })).toBeVisible();
});

test("off the board: the D-pad moves focus, left/right change a select, B goes back", async ({
  page,
}) => {
  await plugIn(page);
  await page.goto("/");
  await page.evaluate(() => window.dispatchEvent(new Event("gamepadconnected")));
  await page.getByRole("button", { name: "Settings" }).click();
  const theme = page.getByLabel("Theme");
  await theme.focus();
  await press(page, RIGHT);
  await expect(theme).toHaveValue("newsprint");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "newsprint");
  await press(page, B);
  await expect(page.getByRole("button", { name: "New Game" })).toBeVisible();
});

test("in Watch your solve the D-pad stays in the replay, and B closes just the replay", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await plugIn(page);
  await seedMediumSave(page, [49]);
  await resumeMedium(page);
  await page.locator('[data-cell="5-4"]').click();
  await page.keyboard.press("2");
  await page.evaluate(() => window.dispatchEvent(new Event("gamepadconnected")));
  await page.getByTestId("watch-solve").click();
  const replay = page.getByTestId("solve-replay");
  await press(page, DOWN, 2);
  await expect(page.locator("dialog[open] :focus")).toHaveCount(1);
  await press(page, B);
  await expect(replay).toBeHidden();
  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeVisible();
});
