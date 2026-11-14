import { test, expect, type Page } from "@playwright/test";

const BOARD = ".grid.aspect-square.w-full.grid-cols-9";
const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
const solved = [...Array(9)].map((_, r) => [...SOLUTION.slice(r * 9, r * 9 + 9)].map(Number));
// The givens: the first four columns blank (a singles-only board).
const initialBoard = solved.map((row) => row.map((v, c) => (c < 4 ? 0 : v)));

// A medium save with the first `left` cells of the first columns (top to bottom) still empty, the
// rest played one every 5 s except for a 90 s wait before the eleventh digit (at 0:50).
async function seed(page: Page, { left = 5, zen = false } = {}) {
  const open = (r: number, c: number) => c * 9 + r < left;
  const currentBoard = solved.map((row, r) => row.map((v, c) => (c < 4 && open(r, c) ? 0 : v)));
  const placements: { r: number; c: number; num: number; t: number }[] = [];
  let t = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 4; c++) {
      if (!currentBoard[r]![c]) continue;
      t += placements.length === 10 ? 90 : 5;
      placements.push({ r, c, num: solved[r]![c]!, t });
    }
  }
  await page.addInitScript((save) => localStorage.setItem("sudoku_v1_save_medium", JSON.stringify(save)), {
    currentBoard,
    initialBoard,
    solvedBoard: solved,
    notesBoard: [...Array(9)].map(() => [...Array(9)].map(() => Array(10).fill(false))),
    difficulty: "medium",
    timerSeconds: t + 20,
    mistakes: 0,
    zen,
    placements,
    savedAt: 1_700_000_000_000,
  });
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Medium/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(`${BOARD} [data-cell]`)).toHaveCount(81);
}

const empties = (page: Page) => page.locator(`${BOARD} [data-cell][aria-label$="empty"]`);
const finish = (page: Page) => page.getByRole("button", { name: "Finish", exact: true });

// When each empty cell got its digit (ms), recorded from the moment this is called.
async function watchFills(page: Page) {
  await page.evaluate((board) => {
    const fills: number[] = ((window as unknown as { fills: number[] }).fills = []);
    new MutationObserver((ms) => {
      for (const m of ms) if (m.oldValue?.endsWith("empty")) fills.push(performance.now());
    }).observe(document.querySelector(board)!, {
      subtree: true,
      attributeFilter: ["aria-label"],
      attributeOldValue: true,
    });
  }, BOARD);
  return () => page.evaluate(() => (window as unknown as { fills: number[] }).fills);
}

test("Finish fills the last singles one by one, wins normally and shows where the player got stuck", async ({
  page,
}) => {
  await seed(page);
  await expect(empties(page)).toHaveCount(5);
  const fills = await watchFills(page);
  await finish(page).click();

  await expect(page.locator(`${BOARD} [data-cell].cell-flash`).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeVisible();
  await expect(empties(page)).toHaveCount(0);
  const times = await fills();
  expect(times).toHaveLength(5);
  expect(times.at(-1)! - times[0]!).toBeGreaterThan(4 * 60); // a cascade, ~80 ms apart

  // A normal win: the slot is cleared, the score recorded, and nothing counts as a hint.
  const stored = await page.evaluate(() => ({
    save: localStorage.getItem("sudoku_v1_save_medium"),
    score: localStorage.getItem("sudoku_v1_score"),
    techniques: localStorage.getItem("sudoku_v1_technique_stats"),
  }));
  expect(stored.save).toBeNull();
  expect(stored.score).not.toBeNull();
  expect(stored.techniques).toBeNull();

  const stuck = page.getByTestId("stuck-moments");
  await expect(stuck).toContainText("Where you got stuck");
  await expect(stuck.getByRole("listitem")).toHaveCount(1);
  await expect(stuck).toContainText("00:50 · 01:30 to the next digit");
  await stuck.getByRole("button").click();
  await expect(page.getByRole("heading", { name: "Sudoku Academy" })).toBeVisible();
  await expect(page.locator('[id^="lesson-"]:focus')).toBeInViewport();
});

test("Finish is only offered for a few cells, with no wrong digit, while not paused", async ({
  page,
}) => {
  await seed(page, { left: 10 });
  await expect(finish(page)).toBeHidden();

  await page.locator(`${BOARD} [data-cell="0-0"]`).click();
  await page.keyboard.press("5"); // correct: nine left
  await expect(finish(page)).toBeVisible();

  await page.locator(`${BOARD} [data-cell="1-0"]`).click();
  await page.keyboard.press("1"); // wrong (it's a 6)
  await expect(finish(page)).toBeHidden();
  await page.keyboard.press("Backspace");
  await expect(finish(page)).toBeVisible();

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(finish(page)).toBeHidden();
});

test("Zen finishes too, without the stuck moments", async ({ page }) => {
  await seed(page, { zen: true });
  await finish(page).click();
  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeVisible();
  await expect(page.getByTestId("stuck-moments")).toBeHidden();
});

test("with reduced motion every cell fills at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page);
  const fills = await watchFills(page);
  await finish(page).click();
  await expect(page.getByRole("heading", { name: "Puzzle solved!" })).toBeVisible();
  const times = await fills();
  expect(times).toHaveLength(5);
  expect(times.at(-1)! - times[0]!).toBeLessThan(50);
});
