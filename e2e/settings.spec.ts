/* oxlint-disable eslint/no-await-in-loop -- key presses are inherently sequential */
import { test, expect, type Page } from "@playwright/test";

import { BOARD, blank, cell, playCustom } from "./seed";

// A solved grid with the first five cells of row 1 blanked (answers 5 3 4 6 7).
const FIVE_BLANKS = blank(0, 1, 2, 3, 4);

async function enterWrongDigits(page: Page, digits: string[]) {
  await cell(page, 0).click();
  for (const d of digits) await page.keyboard.press(d);
}

test("the default limit of 3 mistakes ends the game", async ({ page }) => {
  await page.goto("/");
  await playCustom(page, FIVE_BLANKS);
  await enterWrongDigits(page, ["9", "8", "9"]);
  await expect(page.getByRole("heading", { name: "Game over" })).toBeVisible();
});

test("an unlimited mistake limit keeps the game going and hides the maximum", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Mistake limit").selectOption("0");
  await page.getByRole("button", { name: "Menu" }).click();
  await playCustom(page, FIVE_BLANKS);
  await enterWrongDigits(page, ["9", "8", "9", "8", "9"]);
  await expect(page.getByRole("heading", { name: "Game over" })).toBeHidden();
  await expect(page.getByText("Mistakes:").locator("..")).toContainText("5");
  await expect(page.getByText("/ 3")).toBeHidden();
});

test("hiding the timer removes the clock but keeps pause", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("switch", { name: "Show timer" }).click();
  await page.getByRole("button", { name: "Menu" }).click();
  await playCustom(page, FIVE_BLANKS);
  await expect(page.getByTestId("timer")).toHaveCount(0);
  await expect(page.getByLabel("Pause")).toBeVisible();
});

test("with mistake highlighting off, wrong entries are unmarked and can't end the game", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("switch", { name: "Highlight mistakes" }).click();
  await page.getByRole("button", { name: "Menu" }).click();
  await playCustom(page, FIVE_BLANKS);
  await enterWrongDigits(page, ["9", "8", "9", "8"]);
  await expect(page.getByRole("heading", { name: "Game over" })).toBeHidden();
  await expect(page.getByText("Mistakes:")).toBeHidden();
  // Screen readers get no "wrong entry" either.
  await expect(cell(page, 0)).toHaveAttribute("aria-label", /your entry 8/);
});

test("settings persist across a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Mistake limit").selectOption("5");
  await page.getByRole("switch", { name: "Digit-first input" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByLabel("Mistake limit")).toHaveValue("5");
  await expect(page.getByRole("switch", { name: "Digit-first input" })).toBeChecked();
});

test("the numpad's remaining counts don't reveal wrong entries when highlighting is off", async ({
  page,
}) => {
  const pad = (digit: string) =>
    page.getByTestId("numpad").getByRole("button", { name: new RegExp(`^${digit}(,|$)`) });

  // Highlighting on: a wrong 3 leaves the 3 button available (its count only follows correct digits).
  await page.goto("/");
  await playCustom(page, FIVE_BLANKS);
  await enterWrongDigits(page, ["3"]);
  await expect(pad("3")).toBeEnabled();

  // Highlighting off: the same wrong 3 is counted like any entry, so the button is used up
  // exactly as it would be after a correct one.
  await page.getByLabel("Exit").click();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("switch", { name: "Highlight mistakes" }).click();
  await page.getByRole("button", { name: "Menu" }).click();
  await playCustom(page, FIVE_BLANKS);
  await enterWrongDigits(page, ["3"]);
  await expect(pad("3")).toBeDisabled();
});

test("Zen hides the clock and mistakes, and never ends the game", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("switch", { name: /Zen/ }).click();
  await page.getByRole("button", { name: /Beginner/ }).click();
  await expect(page.getByText("Beginner · Zen")).toBeVisible();
  await expect(page.getByText(/^\d\d:\d\d$/)).toBeHidden();

  // Every digit into one empty cell: at least eight are wrong.
  const empty = page.locator(`${BOARD} [data-cell]`).filter({ hasNotText: /^[1-9]$/ });
  await empty.first().click();
  for (const d of "123456789") await page.keyboard.press(d);
  await expect(page.getByRole("heading", { name: "Game over" })).toBeHidden();
  await expect(page.getByText("Mistakes:")).toBeHidden();
});

test.describe("Display size", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test("Extra large scales the screens around the game and persists", async ({ page }) => {
    const rootSize = () => page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
    await page.goto("/");
    await expect.poll(rootSize).toBe("16px");
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByLabel("Display size").selectOption({ label: "Extra large (150%)" });
    await expect.poll(rootSize).toBe("24px");

    await page.reload();
    await expect.poll(rootSize).toBe("24px");
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByLabel("Display size")).toHaveValue("1.5");

    // The game screen keeps the normal size: its board already fills the height.
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "New Game" }).click();
    await page.getByRole("button", { name: /Beginner/ }).click();
    await expect(page.locator("[data-cell]")).toHaveCount(81);
    await expect.poll(rootSize).toBe("16px");
    await page.getByLabel("Pause").click();
    // Settings opens over the game, so it keeps the game's size too: resizing would shift the board.
    await page.locator(".pause-overlay").getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
    await expect.poll(rootSize).toBe("16px");
  });
});
