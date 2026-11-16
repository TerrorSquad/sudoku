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

  // At rest it's the whole move, as before: the board-accurate caption.
  await expect(step).toHaveText("Step 4 of 4");
  const full = await caption.textContent();

  await watch.getByRole("button", { name: "From the start" }).click();
  await expect(step).toHaveText("Step 1 of 4");
  await expect(caption).toContainText("two candidate cells");
  await expect(watch.getByTestId("pattern-overlay")).toHaveCount(0); // no frames for a fish
  await watch.getByRole("button", { name: "Step forward" }).click();
  await expect(caption).toHaveText("These cells form the pattern.");
  await expect(watch.locator(".pm-ring")).toHaveCount(4);
  await expect(watch.locator(".pm-cross")).toHaveCount(0);

  // ←/→ step once the example has focus.
  await watch.focus();
  await page.keyboard.press("ArrowRight");
  await expect(caption).toContainText("Solid lines");
  await page.keyboard.press("ArrowRight");
  await expect(step).toHaveText("Step 4 of 4");
  await expect(caption).toHaveText(full ?? "");
  await expect(watch.locator(".pm-cross").first()).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(step).toHaveText("Step 3 of 4");

  // Play runs on from the current step by itself (from the start once at the end); Space pauses.
  await watch.getByRole("button", { name: "From the start" }).click();
  await watch.getByTestId("watch-play").click();
  await expect(step).toHaveText("Step 1 of 4");
  await expect(watch.getByTestId("watch-play")).toHaveAttribute("aria-pressed", "true");
  await expect(step).toHaveText("Step 2 of 4", { timeout: 4000 });
  await watch.focus();
  await page.keyboard.press(" ");
  await expect(watch.getByTestId("watch-play")).toHaveAttribute("aria-pressed", "false");
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
  await expect(forward).toBeDisabled(); // at rest on the last step
  await watch.getByRole("button", { name: "Step back" }).click();
  await expect(forward).toBeEnabled();
});

test("the technique map marks the next step and opens a technique's card", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("sudoku_v1_technique_path", JSON.stringify(["naked-single"])),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Academy" }).click();
  await page.getByRole("button", { name: "Map" }).click();
  const map = page.getByTestId("technique-map");
  await expect(map.getByRole("button")).toHaveCount(22);
  await expect(map.getByTestId("map-naked-single")).toHaveAttribute("data-path", "done");
  await expect(map.getByTestId("map-hidden-single")).toHaveAttribute("data-path", "next");
  await expect(map.locator("path")).toHaveCount(22); // one line per BUILDS_ON link

  // Nodes are buttons in reading order, so Tab walks them tier by tier.
  await map.getByTestId("map-naked-single").focus();
  await page.keyboard.press("Tab");
  await expect(map.getByTestId("map-hidden-single")).toBeFocused();

  await map.getByTestId("map-jellyfish").click();
  await expect(page.getByRole("button", { name: "Cards" })).toHaveAttribute("aria-pressed", "true");
  const card = page.locator("#lesson-jellyfish");
  await expect(card).toBeFocused();
  await expect(card.getByTestId("watch-example")).toBeVisible();
});
