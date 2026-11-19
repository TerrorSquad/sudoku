import { test, expect } from "@playwright/test";

import { BOARD, blank, playCustom } from "./seed";

// Turning is display only: data-cell stays the data position, while what's shown and every word
// naming a position follows the turn.
test("the board turns a quarter: cells, arrows and hints follow what the player sees", async ({
  page,
}) => {
  await page.goto("/");
  await playCustom(page, blank(0)); // only R1C1 (a 5) is empty
  const board = page.locator(BOARD);
  const corner = page.locator(`${BOARD} [data-cell="0-8"]`); // the given 2, top-right

  await expect(corner).toHaveAttribute("aria-label", /^Row 1, column 9, given 2/);
  await page.getByRole("button", { name: "Turn the board" }).click();
  await expect(board).toHaveAttribute("data-turn", "1");
  // A clockwise quarter takes the top-right corner to the bottom-right.
  await expect(corner).toHaveAttribute("aria-label", /^Row 9, column 9, given 2/);
  await expect
    .poll(async () => {
      const [b, c] = [await board.boundingBox(), await corner.boundingBox()];
      return c!.x > b!.x + b!.width * 0.8 && c!.y > b!.y + b!.height * 0.8;
    })
    .toBe(true);
  // Its digit still reads upright: the cell's contents turn back.
  await expect(corner.locator("span").first()).toHaveCSS("rotate", "-90deg");

  // Right on screen, on a board turned once, is up a data row.
  await page.locator(`${BOARD} [data-cell="4-4"]`).click();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(`${BOARD} [data-cell="3-4"]`)).toHaveAttribute("aria-selected", "true");

  // The hint names R1C1 where it shows (R1C9), and is retold when the board turns again (R9C9).
  await page.keyboard.press("h");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Place 5 at R1C9.")).toBeVisible();
  await page.keyboard.press("r");
  await expect(board).toHaveAttribute("data-turn", "2");
  await expect(page.getByText("Place 5 at R9C9.")).toBeVisible();

  // Four turns are back to normal; a new board always starts unturned.
  await page.keyboard.press("r");
  await page.keyboard.press("r");
  await expect(board).toHaveAttribute("data-turn", "0");
  await page.keyboard.press("r");
  await page.getByRole("button", { name: "Exit", exact: true }).click();
  await playCustom(page, blank(0));
  await expect(page.locator(BOARD)).not.toHaveAttribute("data-turn", /./);
  await expect(corner).toHaveAttribute("aria-label", /^Row 1, column 9/);
});
