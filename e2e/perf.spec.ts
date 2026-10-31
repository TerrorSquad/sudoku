import { test, expect } from "@playwright/test";

// Highlighting a peer changes the colours of up to 40 cells on every move. With a transition on the
// cells, each of those frames restyled and repainted the board: 45% of a move's CPU on a slow laptop.
test("selecting cells starts no transitions on the board", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Medium/ }).click();
  const cells = page.locator("[data-cell]");
  await expect(cells).toHaveCount(81);
  await cells.nth(10).click();
  await cells.nth(70).click();
  const transitions = await page.evaluate(
    () =>
      document
        .getAnimations()
        .filter(
          (a) =>
            a instanceof CSSTransition &&
            (a.effect as KeyframeEffect).target?.closest("[data-cell]"),
        ).length,
  );
  expect(transitions).toBe(0);
});
