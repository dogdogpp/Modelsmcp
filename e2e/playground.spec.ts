import { test, expect } from "@playwright/test";

test.describe("Playground page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/playground");
  });

  test("displays model selector and run button", async ({ page }) => {
    await expect(page.getByText("Playground").first()).toBeVisible();
    await expect(page.getByText("选择模型").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /运行推理/ })).toBeVisible();
  });

  test("switches model and updates parameters", async ({ page }) => {
    await page.getByRole("button", { name: /YOLOv8/ }).first().click();
    await page.getByRole("button", { name: /PaddleOCR/ }).click();
    await expect(page.getByText("paddleocr_recognize").first()).toBeVisible();
  });

  test("runs inference and displays mock result", async ({ page }) => {
    await page.getByRole("button", { name: /运行推理/ }).click();
    await expect(page.getByText("推理结果")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("inference_time")).toBeVisible();
  });
});

test.describe("Docs page", () => {
  test("shows documentation sections", async ({ page }) => {
    await page.goto("/docs");
    await expect(page.getByText("DeepMCP 开发文档")).toBeVisible();
    await expect(page.getByRole("button", { name: "快速开始" })).toBeVisible();
    await expect(page.getByRole("button", { name: "MCP 协议" })).toBeVisible();
    await expect(page.locator("code").filter({ hasText: "yolov8_detect" }).first()).toBeVisible();
  });
});

test.describe("Status page", () => {
  test("shows system status and refresh button", async ({ page }) => {
    await page.goto("/status");
    await expect(page.getByText("服务状态监控")).toBeVisible();
    await expect(page.getByRole("button", { name: "刷新" })).toBeVisible();
    await expect(page.getByText(/个模型在线/)).toBeVisible();
  });
});
