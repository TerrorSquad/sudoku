import { test, expect } from "@playwright/test";

import { blank, cell, playCustom, unlockAllLevels } from "./seed";

// These start Hard, which a fresh profile has locked.
test.beforeEach(({ page }) => unlockAllLevels(page));

for (const scheme of ["light", "dark"] as const) {
  test(`selecting a digit highlights peers and same digits (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/");
    await page.getByRole("button", { name: "New Game" }).click();
    await page.getByRole("button", { name: /Hard/ }).click();

    const cells = page.locator("div.cursor-pointer.select-none");
    await expect(cells).toHaveCount(81);
    const filled = cells.filter({ hasText: /^[1-9]$/ });
    const digit = ((await filled.first().textContent()) ?? "").trim();
    await filled.first().click();

    const bg = (i: number) => cells.nth(i).evaluate((el) => getComputedStyle(el).backgroundColor);
    const { selected, sameDigit, neutral, peer } = await cells.evaluateAll((els, d) => {
      const texts = els.map((e) => e.textContent?.trim() ?? "");
      const sel = texts.findIndex((t) => t === d);
      const [sr, sc] = [Math.floor(sel / 9), sel % 9];
      const inBox = (i: number) =>
        Math.floor(i / 27) === Math.floor(sr / 3) && Math.floor((i % 9) / 3) === Math.floor(sc / 3);
      const isPeer = (i: number) => Math.floor(i / 9) === sr || i % 9 === sc || inBox(i);
      const idx = els.map((_, i) => i);
      return {
        selected: sel,
        sameDigit: idx.find((i) => i !== sel && texts[i] === d) ?? -1,
        neutral: idx.find((i) => !isPeer(i) && texts[i] !== d) ?? -1,
        peer: idx.find((i) => isPeer(i) && i !== sel && texts[i] !== d) ?? -1,
      };
    }, digit);

    expect(neutral).toBeGreaterThan(-1);
    const [base, selBg, peerBg] = [await bg(neutral), await bg(selected), await bg(peer)];
    expect(peerBg).not.toBe(base);
    expect(selBg).not.toBe(base);
    // A hard puzzle always repeats some digit; if not, the peer check above still holds.
    if (sameDigit > -1) {
      const sameBg = await bg(sameDigit);
      expect(sameBg).not.toBe(base);
      expect(sameBg).not.toBe(selBg);
      expect(sameBg).not.toBe(peerBg);
    }
  });
}

test("a tapped pencil mark or numpad digit lights that candidate up everywhere", async ({
  page,
}) => {
  await page.goto("/");
  await playCustom(page, blank(0, 1, 2, 3, 4));
  const chip = (n: number, d: number) => cell(page, n).locator(`[data-note="${d}"] span`);
  await page.keyboard.press("n");
  await cell(page, 0).click();
  await page.keyboard.press("3");
  await page.keyboard.press("5");
  await cell(page, 2).click();
  await page.keyboard.press("3");
  await page.keyboard.press("4");
  await expect(chip(0, 3)).not.toHaveClass(/bg-violet-600/);

  await cell(page, 0).locator('[data-note="3"]').click();
  await expect(cell(page, 0)).toHaveAttribute("aria-selected", "true");
  await expect(chip(2, 3)).toHaveClass(/bg-violet-600/);
  await expect(chip(0, 3)).toHaveClass(/bg-violet-600/);
  await expect(chip(2, 4)).not.toHaveClass(/bg-violet-600/);

  // The numpad (not digit-first) picks its digit too: here it pencils 4 into cell 1 as well.
  await cell(page, 1).click();
  await page.getByTestId("numpad").getByRole("button", { name: /^4,/ }).click();
  await expect(chip(1, 4)).toHaveClass(/bg-violet-600/);
  await expect(chip(2, 4)).toHaveClass(/bg-violet-600/);
  await expect(chip(2, 3)).not.toHaveClass(/bg-violet-600/);
});

test("Settings can turn off picking a digit by tapping a mark, and the mark highlight", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("switch", { name: "Tap a note to pick its digit" }).click();
  await page.getByRole("button", { name: "Menu" }).click();
  await playCustom(page, blank(0, 1, 2, 3, 4));
  const chip = (n: number, d: number) => cell(page, n).locator(`[data-note="${d}"] span`);
  await page.keyboard.press("n");
  await cell(page, 0).click();
  await page.keyboard.press("3");
  await cell(page, 2).click();
  await page.keyboard.press("3");

  // A tapped mark only selects its cell.
  await cell(page, 0).locator('[data-note="3"]').click();
  await expect(cell(page, 0)).toHaveAttribute("aria-selected", "true");
  await expect(chip(2, 3)).not.toHaveClass(/bg-violet-600/);

  // The numpad still picks its digit (pencilling 3 into cell 1), and the marks light up...
  await cell(page, 1).click();
  await page.getByTestId("numpad").getByRole("button", { name: /^3,/ }).click();
  await expect(chip(2, 3)).toHaveClass(/bg-violet-600/);

  // ...until the highlight is turned off, from Settings over the paused game.
  await page.getByLabel("Pause").click();
  await page.locator(".pause-overlay").getByRole("button", { name: "Settings" }).click();
  await page.getByRole("switch", { name: "Highlight digit in notes" }).click();
  await page.keyboard.press("Escape");
  await page.locator(".pause-overlay").getByRole("button", { name: "Resume" }).click();
  await expect(chip(2, 3)).toHaveText("3");
  await expect(chip(2, 3)).not.toHaveClass(/bg-violet-600/);
});
