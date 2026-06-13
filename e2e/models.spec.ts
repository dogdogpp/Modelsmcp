import { test, expect } from "@playwright/test";

test.describe("Models page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/models");
  });

  test("displays model list and categories", async ({ page }) => {
    await expect(page.getByText("模型市场").first()).toBeVisible();
    await expect(page.getByPlaceholder("搜索模型名称、类别、标签...")).toBeVisible();

    const categories = ["全部", "目标检测", "图像分割", "文字识别", "多模态"];
    for (const category of categories) {
      await expect(page.getByRole("button", { name: category })).toBeVisible();
    }

    await expect(page.getByRole("link", { name: "🎯 YOLOv8 v8.3.0" })).toBeVisible();
  });

  test("filters models by category", async ({ page }) => {
    await page.getByRole("button", { name: "文字识别" }).click();
    await expect(page.getByText("找到")).toBeVisible();
    await expect(page.getByRole("link", { name: /YOLOv8/ })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /PaddleOCR/ })).toBeVisible();
  });

  test("search filters model list", async ({ page }) => {
    const search = page.getByPlaceholder("搜索模型名称、类别、标签...");
    await search.fill("YOLOv8");
    await expect(page.getByRole("link", { name: /YOLOv8/ }).first()).toBeVisible();
    await search.fill("nonexistent-model");
    await expect(page.getByText("未找到匹配的模型")).toBeVisible();
  });

  test("navigates to model detail", async ({ page }) => {
    await page.getByRole("link", { name: "🎯 YOLOv8 v8.3.0" }).click();
    await expect(page).toHaveURL(/\/models\/yolov8/);
    await expect(page.getByText("yolov8_detect").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "概览" })).toBeVisible();
    await expect(page.getByRole("button", { name: "API 参数" })).toBeVisible();
    await expect(page.getByRole("button", { name: "代码示例" })).toBeVisible();
  });

  test("model detail tabs switch content", async ({ page }) => {
    await page.goto("/models/yolov8");
    await expect(page.getByText("应用场景")).toBeVisible();

    await page.getByRole("button", { name: "API 参数" }).click();
    await expect(page.getByText("MCP 调用格式")).toBeVisible();

    await page.getByRole("button", { name: "代码示例" }).click();
    await expect(page.getByText("在 Claude 中使用")).toBeVisible();
  });

  test("unknown model shows 404", async ({ page }) => {
    await page.goto("/models/unknown-model");
    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByText("模型不存在")).toBeVisible();
  });
});
