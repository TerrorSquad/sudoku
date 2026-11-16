import { test, expect } from "@playwright/test";

import { resumeMedium, seedMediumSave } from "./seed";

const BOARD = ".grid.aspect-square.w-full.grid-cols-9";

test("a shared win is a challenge: a friend pastes it, sees the time to beat and beats it", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined }));
  await seedMediumSave(page, [49], 600); // ten minutes on the clock: an easy time to beat
  await resumeMedium(page);
  await page.locator(`${BOARD} [data-cell]`).nth(49).click();
  await page.keyboard.press("2");
  await page.getByRole("button", { name: "Share result" }).click();
  const shared = await page.evaluate(() => navigator.clipboard.readText());
  expect(shared).toMatch(/Beat my time: paste SP1-\d{81}-\d+ into Your puzzle/);

  // The friend pastes the whole share text.
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Your puzzle" }).click();
  await page.locator("textarea").fill(shared);
  await expect(page.getByTestId("challenge")).toHaveText(/A friend's challenge: beat 10:0\d\./);
  await page.getByRole("button", { name: "Play Puzzle" }).click();
  await expect(page.getByTestId("best-time")).toContainText(/To beat 10:0\d/);

  await page.locator(`${BOARD} [data-cell]`).nth(49).click();
  await page.keyboard.press("2");
  await expect(page.getByText(/You beat your friend's time by \d\d:\d\d!/)).toBeVisible();
});
