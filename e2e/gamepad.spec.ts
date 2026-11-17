/* oxlint-disable eslint/no-await-in-loop -- button presses are inherently sequential */
import { test, expect, type Page } from "@playwright/test";

import { BOARD, resumeMedium, seedMediumSave } from "./seed";

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
const [A, B, RB, LT, DOWN, LEFT, RIGHT] = [0, 1, 5, 6, 13, 14, 15];

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

test("the controls tour: A advances, B closes it", async ({ page }) => {
  await plugIn(page);
  await page.addInitScript(() => localStorage.setItem("sudoku_v1_pref_controls_tour", "true"));
  await seedMediumSave(page, [49]);
  await resumeMedium(page);
  await page.evaluate(() => window.dispatchEvent(new Event("gamepadconnected")));
  const tour = page.locator(".driver-popover");
  await expect(tour).toContainText("1 of 5");
  await press(page, A);
  await expect(tour).toContainText("2 of 5");
  await press(page, B);
  await expect(tour).toBeHidden();
  await expect(page.locator('[data-tour="notes"]')).toHaveAttribute("aria-pressed", "false");
});

test("LT opens the move history: left/right scrub, B closes it", async ({ page }) => {
  await plugIn(page);
  await seedMediumSave(page, [49]);
  await resumeMedium(page);
  await page.evaluate(() => window.dispatchEvent(new Event("gamepadconnected")));
  const target = page.locator('[data-cell="5-4"]');
  await target.click();
  await page.keyboard.press("n");
  await page.keyboard.press("7");
  await expect(target).toHaveText("7");

  await press(page, LT);
  const slider = page.getByRole("slider", { name: "Move history" });
  await expect(slider).toBeFocused();
  await press(page, LEFT);
  await expect(slider).toHaveValue("0");
  await expect(target).toHaveText("");
  await press(page, RIGHT);
  await expect(target).toHaveText("7");
  await press(page, B);
  await expect(page.getByRole("dialog", { name: "Move history" })).toBeHidden();
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

test("a lesson's done screen: the D-pad walks its buttons, A presses one, LT changes level", async ({
  page,
}) => {
  await plugIn(page);
  await page.goto("/");
  await page.evaluate(() => window.dispatchEvent(new Event("gamepadconnected")));
  await page.getByRole("button", { name: /Academy/ }).click();
  await page.getByRole("button", { name: "Next challenge: Naked Single" }).click();
  const coach = page.getByTestId("coach");
  await expect(coach).toContainText("Step 1 of 2", { timeout: 30_000 });

  // The named unit's one cell down to one pencil mark, read off the cells' labels.
  const [, kind, n] = /in (row|column|box) (\d)/.exec((await coach.textContent()) ?? "")!;
  const labels = await page
    .locator(`${BOARD} [data-cell]`)
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
  const at = labels.findIndex((l, i) => {
    const [r, c, k] = [Math.floor(i / 9), i % 9, Number(n) - 1];
    const inUnit =
      kind === "row"
        ? r === k
        : kind === "column"
          ? c === k
          : Math.floor(r / 3) * 3 + Math.floor(c / 3) === k;
    return inUnit && /notes \d$/.test(l);
  });
  await page.locator(`${BOARD} [data-cell]`).nth(at).click();
  await page.keyboard.press(/notes (\d)$/.exec(labels[at]!)![1]!);
  await expect(coach).toContainText("Well done!");

  // Down walks the coach's open buttons: the two open levels, then Next level.
  await press(page, DOWN, 3);
  const nextLevel = coach.getByRole("button", { name: "Next level: Less help" });
  await expect(nextLevel).toBeFocused();
  await press(page, A);
  await expect(coach.getByTestId("level-2")).toHaveAttribute("aria-pressed", "true", {
    timeout: 30_000,
  });
  // LT: the next open level, round to the first.
  await press(page, LT);
  await expect(coach.getByTestId("level-1")).toHaveAttribute("aria-pressed", "true", {
    timeout: 30_000,
  });
});
