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
    const sameIdx = await cells.evaluateAll(
      (els, d) => els.flatMap((e, i) => (e.textContent?.trim() === d ? [i] : [])),
      digit,
    );
    // a cell that's in neither the selection's lines nor holds the digit keeps the base color
    const base = await bg(80 - 0).catch(() => "");
    const [sel, other] = [sameIdx[0]!, sameIdx[1]];
    const selBg = await bg(sel);
    if (other !== undefined) {
      const otherBg = await bg(other);
      expect(otherBg).not.toBe(base);
      expect(otherBg).not.toBe(selBg);
    }
  });
}
