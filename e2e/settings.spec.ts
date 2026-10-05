/* oxlint-disable eslint/no-await-in-loop -- key presses are inherently sequential */
import { test, expect, type Page } from "@playwright/test";

const BOARD = ".grid.aspect-square.w-full.grid-cols-9";
// A solved grid with the first five cells of row 1 blanked (answers 5 3 4 6 7).
const FIVE_BLANKS =
  "000008912672195348198342567859761423426853791713924856961537284287419635345286179";

async function playCustom(page: Page) {
  await page.getByRole("button", { name: "Custom Puzzle" }).click();
  await page.locator("textarea").fill(FIVE_BLANKS);
  await page.getByRole("button", { name: "Play Puzzle" }).click();
}
const cell = (page: Page, n: number) => page.locator(`${BOARD} [data-cell]`).nth(n);

async function enterWrongDigits(page: Page, digits: string[]) {
  await cell(page, 0).click();
  for (const d of digits) await page.keyboard.press(d);
}

test("the default limit of 3 mistakes ends the game", async ({ page }) => {
  await page.goto("/");
  await playCustom(page);
  await enterWrongDigits(page, ["9", "8", "9"]);
  await expect(page.getByRole("heading", { name: "Game Over" })).toBeVisible();
});

test("an unlimited mistake limit keeps the game going and hides the maximum", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Mistake limit").selectOption("0");
  await page.getByRole("button", { name: "Menu" }).click();
  await playCustom(page);
  await enterWrongDigits(page, ["9", "8", "9", "8", "9"]);
  await expect(page.getByRole("heading", { name: "Game Over" })).toBeHidden();
  await expect(page.getByText("Mistakes:").locator("..")).toContainText("5");
  await expect(page.getByText("/ 3")).toBeHidden();
});

test("hiding the timer removes the clock but keeps pause", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("switch", { name: "Show timer" }).click();
  await page.getByRole("button", { name: "Menu" }).click();
  await playCustom(page);
  await expect(page.locator(".font-mono.tabular-nums.font-bold")).toHaveCount(0);
  await expect(page.getByLabel("Pause")).toBeVisible();
});

test("with mistake highlighting off, wrong entries are unmarked and can't end the game", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("switch", { name: "Highlight mistakes" }).click();
  await page.getByRole("button", { name: "Menu" }).click();
  await playCustom(page);
  await enterWrongDigits(page, ["9", "8", "9", "8"]);
  await expect(page.getByRole("heading", { name: "Game Over" })).toBeHidden();
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
