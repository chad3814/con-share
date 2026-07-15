import { test, expect } from "@playwright/test";

test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Con-Share" })).toBeVisible();
});

test("admin redirects to login when logged out", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});

test("unknown convention slug returns 404", async ({ page }) => {
  const res = await page.goto("/c/does-not-exist");
  expect(res?.status()).toBe(404);
});
