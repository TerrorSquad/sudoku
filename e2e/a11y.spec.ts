/* oxlint-disable eslint/no-await-in-loop -- browser steps are inherently sequential */
import { AxeBuilder } from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

import { fakeWavedash } from "./fakeWavedash";
import { resumeMedium, seedMediumSave } from "./seed";

// Automated WCAG 2.x A/AA scan of every screen in both colour schemes. Axe catches roughly a
// third of real issues (contrast, names, roles, ARIA misuse) — it complements, not replaces,
// the keyboard tests below.

async function scan(page: Page, name: string) {
  // Screens cross-fade; scanning while the old one is still fading out misreads its contrast.
  await page.waitForFunction(
    () => document.querySelectorAll(".screen-leave-active, .screen-enter-active").length === 0,
  );
  const { violations } = await new AxeBuilder({ page })
    // Nuxt DevTools' own floating badge (dev server only) isn't part of the app.
    .exclude("nuxt-devtools-frame")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const summary = violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes.length} node(s), e.g. ${v.nodes[0]?.target.join(" ")} — ${v.nodes[0]?.any[0]?.message ?? ""}`,
  );
  expect.soft(summary, `${name} should have no axe violations`).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(scheme, () => {
    // Scan the settled state: screens cross-fade in, and axe computes contrast mid-fade otherwise.
    test.use({ colorScheme: scheme, reducedMotion: "reduce" });

    test("menu, difficulty and secondary screens", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("button", { name: "New Game" })).toBeVisible();
      await scan(page, "menu");

      await page.getByRole("button", { name: "New Game" }).click();
      await scan(page, "difficulty");
      await page.getByRole("button", { name: "Back to Menu" }).click();

      for (const [button, screen] of [
        ["Daily puzzle", "daily"],
        ["Academy", "academy"],
        ["Statistics", "stats"],
        ["Achievements", "achievements"],
        ["Settings", "settings"],
        ["Your puzzle", "custom puzzle"],
      ] as const) {
        await page.getByRole("button", { name: button }).click();
        await scan(page, screen);
        await page.reload();
      }
    });

    test("Academy technique map and a Watch it example", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "Academy" }).click();
      await page.getByRole("button", { name: "Map" }).click();
      await expect(page.getByTestId("technique-map")).toBeVisible();
      await scan(page, "academy (map)");
      await page.getByTestId("map-x-wing").click();
      await page.locator("#lesson-x-wing").getByRole("button", { name: "From the start" }).click();
      await scan(page, "academy (watch it)");
    });

    test("stats with Wavedash leaderboards", async ({ page }) => {
      await fakeWavedash(page);
      await page.goto("/");
      await page.getByRole("button", { name: "Statistics" }).click();
      await expect(
        page.getByRole("region", { name: "Leaderboards" }).getByRole("listitem"),
      ).toHaveCount(3);
      await scan(page, "stats (leaderboards)");
    });

    test("game screen in colour mode", async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem("sudoku_v1_pref_color_mode", "true"));
      await page.goto("/");
      await page.getByRole("button", { name: "New Game" }).click();
      await page.getByRole("button", { name: /Easy/ }).click();
      await expect(page.locator(".grid.aspect-square")).toBeVisible();
      await scan(page, "game (colour mode)");
    });

    test("win modal with a stamp and a record, then the stats records", async ({ page }) => {
      await page.addInitScript(() => {
        if (localStorage.getItem("sudoku_v1_records")) return;
        localStorage.setItem(
          "sudoku_v1_records",
          JSON.stringify({ cleanRun: 1, bestCleanRun: 1, mostInDay: 1 }),
        );
      });
      await seedMediumSave(page, [49]);
      await resumeMedium(page);
      await page.locator(".grid.aspect-square.w-full.grid-cols-9 [data-cell]").nth(49).click();
      await page.keyboard.press("2");
      await expect(page.getByTestId("perfect-stamp")).toHaveClass(/stamp-in/);
      await expect(page.getByTestId("new-record")).toHaveCount(1);
      await scan(page, "win modal");
      await page.getByTestId("watch-solve").click();
      await expect(page.getByTestId("solve-replay")).toBeVisible();
      await scan(page, "solve replay");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Close" }).click();
      await page.getByRole("button", { name: "Statistics" }).click();
      await expect(page.getByTestId("records")).toBeVisible();
      await scan(page, "stats (records)");
    });

    for (const theme of ["newsprint", "contrast", "blueprint", "chalkboard"]) {
      test(`${theme} theme: menu, game and Settings over it`, async ({ page }) => {
        await page.addInitScript(
          (t) => localStorage.setItem("sudoku_v1_pref_board_theme", JSON.stringify(t)),
          theme,
        );
        await page.goto("/");
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await scan(page, `menu (${theme})`);
        await page.getByRole("button", { name: "New Game" }).click();
        await page.getByRole("button", { name: /Easy/ }).click();
        await expect(page.locator(".grid.aspect-square")).toBeVisible();
        await scan(page, `game (${theme})`);
        await page.getByLabel("Pause").click();
        await page.locator(".pause-overlay").getByRole("button", { name: "Settings" }).click();
        await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
        await scan(page, `settings over the game (${theme})`);
      });
    }

    test("game screen", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "New Game" }).click();
      await page.getByRole("button", { name: /Easy/ }).click();
      await expect(page.locator(".grid.aspect-square")).toBeVisible();
      await scan(page, "game");
      // A picked candidate's chips, then the move history over the board.
      // One mark per cell: a cell's several marks run together as text no label can match.
      await page.locator("[data-cell]").filter({ hasText: /^$/ }).first().click();
      await page.keyboard.press("n");
      await page.keyboard.press("5");
      await page.locator('[data-note="5"]').click();
      await scan(page, "game (candidate picked)");
      await page.keyboard.press("Shift+Z");
      await expect(page.getByRole("dialog", { name: "Move history" })).toBeVisible();
      await scan(page, "move history");
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

  // WASD walks the same way.
  await page.keyboard.press("d");
  await page.keyboard.press("s");
  await page.keyboard.press("s");
  await page.keyboard.press("a");
  await page.keyboard.press("w");
  await expect(cell(1, 0)).toHaveAttribute("aria-selected", "true");
  await expect(cell(1, 0)).toBeFocused();
});

test("the menu's seasonal paper is decoration only, and still under reduced motion", async ({
  page,
}) => {
  await page.addInitScript(() => ((window as { season?: string }).season = "winter"));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "New Game" })).toBeVisible();
  const bits = page.locator(".season-bit");
  await expect(bits).toHaveCount(9);
  await expect(bits.first()).toBeVisible();
  await scan(page, "menu (winter)");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(bits.first()).toBeHidden();
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
