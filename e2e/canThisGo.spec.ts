import { test, expect, type Page } from "@playwright/test";

import { getGridCandidates, makeRng } from "../app/utils/sudokuCore";
import { generateGradedPuzzle, movesNow, removerOf } from "../app/utils/sudokuGrader";
import en from "../i18n/locales/en.json" with { type: "json" };
import { cell, playCustom } from "./seed";

// "Can this go?" on a pencil mark: asked by the solver's own moves, never the answer key.
const { puzzle } = generateGradedPuzzle("expert", makeRng(3));
const moves = movesNow(puzzle);
const name = (id: string) => (en as Record<string, string>)[`hint.move.${id}.name`]!;
const ask = (page: Page, num: number) =>
  page.getByRole("button", { name: `Does anything rule out ${num} here?` }).click();

async function start(page: Page) {
  await page.goto("/");
  await playCustom(page, puzzle.flat().join(""));
  await page.getByRole("button", { name: "Fill notes" }).click();
}

test("a mark a technique removes says which, and Show me opens it at where to look", async ({
  page,
}) => {
  const mark = moves.find((m) => m.tier >= 2 && !m.placement)!.eliminations[0]!;
  const remover = removerOf(moves, mark)!;
  await start(page);
  await cell(page, mark.r * 9 + mark.c).click();
  await ask(page, mark.num);
  await expect(page.getByTestId("can-go-answer")).toHaveText(
    `Yes: ${name(remover.technique)} removes ${mark.num} from this cell.`,
  );
  await page.getByRole("button", { name: "Show me" }).click();
  await expect(page.getByText("Where to look")).toBeVisible();
  await expect(page.getByTestId("can-this-go")).toHaveCount(0);
});

test("a mark nothing removes yet says so, on a phone too", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  const mark = getGridCandidates(puzzle)
    .flatMap((row, r) => row.flatMap((cs, c) => cs.map((num) => ({ r, c, num }))))
    .find((at) => !removerOf(moves, at))!;
  await start(page);
  await cell(page, mark.r * 9 + mark.c).click();
  await ask(page, mark.num);
  await expect(page.getByTestId("can-go-answer")).toHaveText(
    `Nothing on the board removes ${mark.num} from this cell yet.`,
  );
  await expect(page.getByRole("button", { name: "Show me" })).toHaveCount(0);
  // A pencil mark its row already holds: the clash is the answer.
  const given = puzzle[mark.r]!.find((v) => v)!;
  await page.keyboard.press("n");
  await page.keyboard.press(String(given));
  await ask(page, given);
  await expect(page.getByTestId("can-go-answer")).toContainText("already holds");
});
