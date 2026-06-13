import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("home page loads and shows key elements", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("深度模型MCP网站");
    await expect(page.getByText("本地深度模型").first()).toBeVisible();
    await expect(page.getByText("MCP 推理平台").first()).toBeVisible();
    await expect(page.locator("nav").getByRole("link", { name: /模型市场/ })).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: /浏览模型/ })).toBeVisible();
  });

  test("navigation links route to correct pages", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav");

    await nav.getByRole("link", { name: /模型市场/ }).click();
    await expect(page).toHaveURL(/\/models/);
    await expect(page.getByText("模型市场").first()).toBeVisible();

    await nav.getByRole("link", { name: /Playground/ }).click();
    await expect(page).toHaveURL(/\/playground/);
    await expect(page.getByText("Playground").first()).toBeVisible();

    await nav.getByRole("link", { name: /文档/ }).click();
    await expect(page).toHaveURL(/\/docs/);
    await expect(page.getByText("文档").first()).toBeVisible();

    await nav.getByRole("link", { name: /状态/ }).click();
    await expect(page).toHaveURL(/\/status/);
    await expect(page.getByText("状态").first()).toBeVisible();

    await nav.getByRole("link", { name: /首页/ }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("logo returns to home page", async ({ page }) => {
    await page.goto("/models");
    await page.locator("nav").getByText("DeepMCP").first().click();
    await expect(page).toHaveURL(/\/$/);
  });
});
