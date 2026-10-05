import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const SCORE = { total: 4242, gamesWon: 7, best: {}, perDifficulty: {} };

test("export downloads a backup and import restores it after a wipe", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((score) => {
    localStorage.setItem("sudoku_v1_score", JSON.stringify(score));
    localStorage.setItem("not_ours", "stay");
  }, SCORE);

  await page.getByRole("button", { name: "Settings" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export", exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^sudoku-pro-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await download.path();
  const backup = JSON.parse(readFileSync(file, "utf8"));
  expect(backup).toMatchObject({ app: "sudoku-pro", version: 1 });
  expect(Object.keys(backup.data)).toContain("sudoku_v1_score");
  expect(Object.keys(backup.data)).not.toContain("not_ours");

  // Wipe the game's data, then import the file.
  await page.evaluate(() => localStorage.removeItem("sudoku_v1_score"));
  await page.getByTestId("import-file").setInputFiles(file);
  await expect(page.getByRole("alertdialog")).toContainText("Replace your current progress");
  await page.getByRole("button", { name: "Replace", exact: true }).click();

  // The page reloads; the score is back (level badge reflects 4242 points) and the foreign key is untouched.
  await expect(page.getByRole("button", { name: "New Game" })).toBeVisible();
  const restored = await page.evaluate(() => ({
    score: JSON.parse(localStorage.getItem("sudoku_v1_score") ?? "null"),
    foreign: localStorage.getItem("not_ours"),
  }));
  expect(restored.score.total).toBe(4242);
  expect(restored.foreign).toBe("stay");
  await expect(page.getByTestId("level-badge")).toContainText("Level 4");
});

test("a file that isn't a backup is refused and changes nothing", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(
    (score) => localStorage.setItem("sudoku_v1_score", JSON.stringify(score)),
    SCORE,
  );
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByTestId("import-file").setInputFiles({
    name: "nope.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"hello":"world"}'),
  });
  await expect(page.getByRole("alert")).toContainText("isn't a Sudoku Pro backup");
  await expect(page.getByRole("alertdialog")).toBeHidden();
  const total = await page.evaluate(
    () => JSON.parse(localStorage.getItem("sudoku_v1_score")!).total,
  );
  expect(total).toBe(4242);
});

test("cancelling leaves current progress alone", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(
    (score) => localStorage.setItem("sudoku_v1_score", JSON.stringify(score)),
    SCORE,
  );
  await page.getByRole("button", { name: "Settings" }).click();
  const backup = {
    app: "sudoku-pro",
    version: 1,
    exportedAt: "2026-01-01T00:00:00.000Z",
    data: {
      sudoku_v1_score: JSON.stringify({ total: 1, gamesWon: 0, best: {}, perDifficulty: {} }),
    },
  };
  await page.getByTestId("import-file").setInputFiles({
    name: "b.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  const total = await page.evaluate(
    () => JSON.parse(localStorage.getItem("sudoku_v1_score")!).total,
  );
  expect(total).toBe(4242);
});
