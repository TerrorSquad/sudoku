import { test, expect } from "@playwright/test";

test("color mode preference persists across a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  const colorSwitch = page.getByRole("switch", { name: "Color mode" });
  await expect(colorSwitch).not.toBeChecked();
  await colorSwitch.click();
  await expect(colorSwitch).toBeChecked();

  await page.reload();
  await page.getByRole("button", { name: "New Game" }).click();
  await expect(page.getByRole("switch", { name: "Color mode" })).toBeChecked();
});

test("sound preference persists across a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New Game" }).click();
  const soundSwitch = page.getByRole("switch", { name: "Sound" });
  await expect(soundSwitch).toBeChecked();
  await soundSwitch.click();
  await expect(soundSwitch).not.toBeChecked();

  await page.reload();
  await page.getByRole("button", { name: "New Game" }).click();
  await expect(page.getByRole("switch", { name: "Sound" })).not.toBeChecked();
});
