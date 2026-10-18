import { expect, test } from "@playwright/test";

test("login screen exposes labelled credentials and password recovery", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Sign in to Nelemane" })).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveAttribute("type", "email");
  await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
  await expect(page.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute("href", "/forgot-password");
});

test("contact, privacy and terms pages load through their public links", async ({ page }) => {
  await page.goto("/contact?intent=support");
  await expect(page.getByRole("heading", { name: "Contact Nelemane" })).toBeVisible();
  await expect(page.getByLabel("Your name")).toBeVisible();

  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy at Nelemane" })).toBeVisible();

  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Terms of use" })).toBeVisible();
});

test("manual dark mode persists and the public page fits a 360px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/privacy");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect.poll(() => page.locator("html").getAttribute("class")).toContain("dark");

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(360);

  await page.reload();
  await expect.poll(() => page.locator("html").getAttribute("class")).toContain("dark");
});
