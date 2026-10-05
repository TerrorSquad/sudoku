/* oxlint-disable eslint/no-await-in-loop -- browser steps are inherently sequential */
import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

// Automated WCAG 2.x A/AA scan of every screen in both colour schemes. Axe catches roughly a
// third of real issues (contrast, names, roles, ARIA misuse) — it complements, not replaces,
// the keyboard tests below.

async function scan(page: Page, name: string) {
  const { violations } = await new AxeBuilder({ page })
    // Nuxt DevTools' own floating badge (dev server only) isn't part of the app.
    .exclude("nuxt-devtools-frame")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const summary = violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s), e.g. ${v.nodes[0]?.target.join(" ")}`,
  );
  expect.soft(summary, `${name} should have no axe violations`).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(scheme, () => {
    test.use({ colorScheme: scheme });

    test("menu, difficulty and secondary screens", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("button", { name: "New Game" })).toBeVisible();
      await scan(page, "menu");

      await page.getByRole("button", { name: "New Game" }).click();
      await scan(page, "difficulty");
      await page.getByRole("button", { name: "Back to Menu" }).click();

      for (const [button, screen] of [
        ["Sudoku Academy", "academy"],
        ["Statistics", "stats"],
        ["Achievements", "achievements"],
        ["Settings", "settings"],
        ["Custom Puzzle", "custom puzzle"],
      ] as const) {
        await page.getByRole("button", { name: button }).click();
        await scan(page, screen);
        await page.reload();
      }
    });

    test("game screen", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "New Game" }).click();
      await page.getByRole("button", { name: /Easy/ }).click();
      await expect(page.locator(".grid.aspect-square")).toBeVisible();
      await scan(page, "game");
    });
  });
}

test("the board is an ARIA grid of 9 rows × 9 labelled cells", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Beginner/ }).click();
  const grid = page.getByRole("grid", { name: "Sudoku board" });
  await expect(grid.getByRole("row")).toHaveCount(9);
  await expect(grid.getByRole("gridcell")).toHaveCount(81);
  await expect(grid.getByRole("gridcell").first()).toHaveAttribute(
    "aria-label",
    /^Row 1, column 1, (given \d|empty)/,
  );
});

test("arrow keys move the selection and focus, clamped at the edges", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Beginner/ }).click();
  const cell = (r: number, c: number) => page.locator(`[data-cell="${r}-${c}"]`);

  await page.keyboard.press("ArrowDown"); // nothing selected yet → top-left
  await expect(cell(0, 0)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await expect(cell(1, 1)).toHaveAttribute("aria-selected", "true");
  await expect(cell(1, 1)).toBeFocused();

  for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowUp");
  for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowLeft");
  await expect(cell(0, 0)).toHaveAttribute("aria-selected", "true");
});

test("reduced motion removes animation durations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  const dur = await page
    .getByRole("button", { name: /Beginner/ })
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(dur).toBe("1e-05s");
});
