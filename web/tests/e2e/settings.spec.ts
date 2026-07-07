import { expect, test } from "@playwright/test";
import { openUserMenu, seedAuthenticatedSession } from "./helpers";

test.describe("MVP settings menu", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedSession(page);
    await page.goto("/chat");
    await expect(page.getByText("今天要处理什么？")).toBeVisible();
  });

  test("opens the MVP settings sections", async ({ page }) => {
    await openUserMenu(page);
    await page.getByRole("menuitem", { name: "智能体与模型" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("已登记 CLI 智能体")).toBeVisible();
    await expect(page.getByText("Codex CLI")).toBeVisible();

    await page.getByRole("tab", { name: "模型 API" }).click();
    await expect(page.getByText("添加模型厂商")).toBeVisible();
    await expect(page.getByText("尚未配置模型厂商")).toBeVisible();

    await page.getByRole("button", { name: "账号与权限" }).click();
    await expect(page.getByText("登录手机号")).toBeVisible();
    await expect(page.getByText("已开通模块")).toBeVisible();

    await page.getByRole("button", { name: "关于与帮助" }).click();
    await expect(page.getByText("复制诊断信息")).toBeVisible();
    await expect(page.getByText("使用帮助与反馈")).toBeVisible();
  });

  test("sanitizes provider auth errors in settings notices", async ({ page }) => {
    await page.route("**/api/byok/test", async (route) => {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error:
            'Incorrect API key provided: sk-proj-abc123xyz. {"error":{"message":"invalid_api_key"}}',
        }),
      });
    });

    await openUserMenu(page);
    await page.getByRole("menuitem", { name: "智能体与模型" }).click();
    await page.getByRole("tab", { name: "模型 API" }).click();
    await page.getByRole("button", { name: /OpenAI|Anthropic|DeepSeek|自定义 OpenAI/i }).first().click();

    const providerCard = page.locator(".model-provider-card").first();
    await providerCard.getByRole("checkbox").check();
    await providerCard.getByLabel("Base URL").fill("https://api.openai.com/v1");
    await providerCard.getByLabel("API Key").fill("sk-proj-abc123xyz");
    await providerCard.getByRole("button", { name: "测试连接" }).click();

    await expect(
      page.getByText(/API Key 校验失败，请检查当前 Provider 的 API Key 是否正确/i),
    ).toBeVisible();
    await expect(page.getByText(/sk-proj-abc123xyz/)).toHaveCount(0);
    await expect(page.getByText(/invalid_api_key/)).toHaveCount(0);
  });
});
