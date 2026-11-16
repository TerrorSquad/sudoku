/* oxlint-disable eslint/no-await-in-loop -- browser steps are inherently sequential */
import { test, expect } from "@playwright/test";

test("Watch it steps an X-Wing through its beats, by button and by key", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Academy" }).click();
  const card = page.locator("#lesson-x-wing");
  await card.locator("h3").click();
  const watch = card.getByTestId("watch-example");
  const caption = watch.getByTestId("watch-caption");
  const step = watch.getByText(/^Step \d of \d$/);

  // At rest it's the whole move, told with the example's real rows and columns.
  await expect(step).toHaveText("Step 4 of 4");
  const full = await caption.textContent();

  await watch.getByRole("button", { name: "From the start" }).click();
  await expect(step).toHaveText("Step 1 of 4");
  await expect(caption).toContainText("two candidate cells");
  await expect(watch.getByTestId("pattern-overlay")).toHaveCount(0); // no frames for a fish
  await watch.getByRole("button", { name: "Step forward" }).click();
  await expect(caption).toHaveText(
    /^In (rows|columns) \d and \d, 6 can only go in (rows|columns) \d and \d\.$/,
  );
  await expect(watch.locator(".pm-ring")).toHaveCount(4);
  await expect(watch.locator(".pm-cross")).toHaveCount(0);

  // ←/→ step once the example has focus.
  await watch.focus();
  await page.keyboard.press("ArrowRight");
  await expect(caption).toContainText("The base is");
  await page.keyboard.press("ArrowRight");
  await expect(step).toHaveText("Step 4 of 4");
  // The last beat tells the result: the end of the whole move's words.
  await expect(caption).toHaveText(/^So no other cell in (rows|columns) /);
  expect(full).toContain(await caption.textContent());
  await expect(watch.locator(".pm-cross").first()).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(step).toHaveText("Step 3 of 4");

  // A step button at the end stays focused (aria-disabled, not disabled), so the keys still work.
  const forward = watch.getByRole("button", { name: "Step forward" });
  await forward.click();
  await expect(forward).toHaveAttribute("aria-disabled", "true");
  await expect(forward).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(step).toHaveText("Step 3 of 4");

  // Play runs on from the current step by itself (from the start once at the end); Space pauses.
  const play = watch.getByTestId("watch-play");
  await watch.getByRole("button", { name: "From the start" }).click();
  await play.click();
  await expect(step).toHaveText("Step 1 of 4");
  await expect(play).toHaveText("Pause");
  await expect(step).toHaveText("Step 2 of 4", { timeout: 4000 });
  await watch.focus();
  await page.keyboard.press(" ");
  await expect(play).toHaveText("Watch it");
  const paused = await step.textContent();
  await page.waitForTimeout(2200);
  await expect(step).toHaveText(paused ?? "");
});

test("with reduced motion, Watch it has only the step controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Academy" }).click();
  const card = page.locator("#lesson-pointing");
  await card.locator("h3").click();
  const watch = card.getByTestId("watch-example");
  await expect(watch.getByTestId("watch-play")).toHaveCount(0);
  const forward = watch.getByRole("button", { name: "Step forward" });
  const step = watch.getByText(/^Step \d of \d$/);
  await expect(forward).toHaveAttribute("aria-disabled", "true"); // at rest on the last step
  await watch.getByRole("button", { name: "Step back" }).click();
  await expect(forward).toHaveAttribute("aria-disabled", "false");
  // Space steps on instead of playing, round to the start after the last step.
  const before = await step.textContent();
  await watch.focus();
  await page.keyboard.press(" ");
  await expect(step).not.toHaveText(before ?? "");
  await expect(step).toHaveText(/^Step (\d) of \1$/);
  await page.keyboard.press(" ");
  await expect(step).toHaveText(/^Step 1 of \d$/);
});

test("the technique map marks the next step and opens a technique's card", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("sudoku_v1_technique_path", JSON.stringify(["naked-single"])),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Academy" }).click();
  await page.getByRole("button", { name: "Map" }).click();
  const map = page.getByTestId("technique-map");
  await expect(map.getByRole("button")).toHaveCount(25);
  await expect(map.getByTestId("map-naked-single")).toHaveAttribute("data-path", "done");
  await expect(map.getByTestId("map-hidden-single")).toHaveAttribute("data-path", "next");
  await expect(map.locator("path")).toHaveCount(27); // one line per BUILDS_ON link

  // Nodes are buttons in the order they're drawn, so Tab walks each tier left to right.
  await map.getByTestId("map-hidden-single").focus();
  await page.keyboard.press("Tab");
  await expect(map.getByTestId("map-naked-triple")).toBeFocused(); // leftmost Intermediate node
  // The drawn links are hidden from screen readers; each node says what it builds on.
  await expect(map.getByTestId("map-hidden-pair")).toContainText(
    "Builds on Hidden Single, Naked Pair",
  );

  await map.getByTestId("map-jellyfish").click();
  await expect(page.getByRole("button", { name: "Cards" })).toHaveAttribute("aria-pressed", "true");
  const card = page.locator("#lesson-jellyfish");
  await expect(card).toBeFocused();
  await expect(card.getByTestId("watch-example")).toBeVisible();
});
