import { test, expect } from "@playwright/test";

// A solved grid with the first five cells of row 1 blanked (answers 5 3 4 6 7).
const FIVE_BLANKS =
  "000008912672195348198342567859761423426853791713924856961537284287419635345286179";

test("a placement hint marks its target green, not as the yellow selection", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Your puzzle" }).click();
  await page.locator("textarea").fill(FIVE_BLANKS);
  await page.getByRole("button", { name: "Play Puzzle" }).click();
  await page.locator('[data-cell="4-4"]').click();
  await page.getByRole("button", { name: "Hint" }).first().click();

  await expect(page.locator(".ring-emerald-500[data-cell]")).toHaveCount(1);
  await expect(page.locator('[data-cell][aria-selected="true"]')).toHaveCount(0);
  await expect(page.getByText("Target cell")).toBeVisible();
  await expect(page.getByText("Candidates to remove")).toBeHidden();
  // Below the general description, this move on this board, by its real row and column.
  await expect(page.getByTestId("hint-detail")).toContainText(/row 1, column [1-5]\b/);
});

test("the idle hint panel names what applies on the board, and steps aside for a hint", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Your puzzle" }).click();
  await page.locator("textarea").fill(FIVE_BLANKS);
  await page.getByRole("button", { name: "Play Puzzle" }).click();
  const list = page.getByTestId("board-techniques");
  await expect(list.getByRole("listitem")).toHaveText(["Naked Single", "Hidden Single"]);
  await page.getByRole("button", { name: "Hint" }).first().click();
  await expect(list).toBeHidden();
});

test("a technique picked from the panel's list opens at where to look, then shows and applies", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Your puzzle" }).click();
  await page.locator("textarea").fill(FIVE_BLANKS);
  await page.getByRole("button", { name: "Play Puzzle" }).click();
  await page.getByTestId("board-techniques").getByRole("button", { name: "Hidden Single" }).click();

  // Step 1 names the unit only: no target yet.
  await expect(page.getByText("Where to look")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hidden Single" })).toBeVisible();
  await expect(page.locator(".ring-emerald-500[data-cell]")).toHaveCount(0);

  // The picked button is gone, so focus moved to Next; the Hint key steps on instead of applying.
  await expect(page.getByRole("button", { name: "Next" })).toBeFocused();
  await page.keyboard.press("h");
  await expect(page.locator(".ring-emerald-500[data-cell]")).toHaveCount(1);
  await expect(page.locator('[data-cell][aria-label*="your entry"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Apply" }).click();
  // Applied: one digit in, and the list is back.
  await expect(page.getByTestId("board-techniques")).toBeVisible();
  await expect(page.locator('[data-cell][aria-label*="your entry"]')).toHaveCount(1);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 412, height: 839 } }); // Pixel 7

  test("the list is a strip under the numpad: a pick opens where to look; gone in a hint or pause", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Your puzzle" }).click();
    await page.locator("textarea").fill(FIVE_BLANKS);
    await page.getByRole("button", { name: "Play Puzzle" }).click();
    const strip = page.getByTestId("board-techniques");
    await expect(strip.getByRole("listitem")).toHaveText(["Naked Single", "Hidden Single"]);
    await expect(strip).toBeInViewport();
    // Under the numpad, which stays on screen.
    const numpad = page.getByTestId("numpad");
    await expect(numpad).toBeInViewport({ ratio: 1 });
    const pad = (await numpad.boundingBox())!;
    expect((await strip.boundingBox())!.y).toBeGreaterThanOrEqual(pad.y + pad.height);

    await page.getByRole("button", { name: "Pause" }).click();
    await expect(strip).toBeHidden();
    await page.getByRole("button", { name: "Resume" }).first().click();

    await strip.getByRole("button", { name: "Hidden Single" }).click();
    await expect(page.getByText("Where to look")).toBeVisible();
    await expect(strip).toBeHidden();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(strip).toBeVisible();

    await page.getByRole("button", { name: "Hint" }).first().click();
    await expect(strip).toBeHidden();
  });
});
