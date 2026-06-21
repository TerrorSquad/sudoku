import { test, expect } from "@playwright/test";

test("pausing shows the overlay and freezes the timer; resume hides it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  await page.getByRole("button", { name: /Hard/ }).click();

  await page.getByLabel("Pause").click();
  await expect(page.getByText("Paused")).toBeVisible();

  const timer = page.locator(".font-mono.tabular-nums");
  const frozenAt = await timer.textContent();
  await page.waitForTimeout(2200);
  await expect(timer).toHaveText(frozenAt ?? "");

  await page.locator(".pause-overlay").getByRole("button", { name: "Resume" }).click();
  await expect(page.getByText("Paused")).toBeHidden();
});
