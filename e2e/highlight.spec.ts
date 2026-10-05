import { test, expect } from "@playwright/test";

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
