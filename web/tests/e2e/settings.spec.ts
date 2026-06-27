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
    await expect(page.getByText("预置智能体组件")).toBeVisible();
    await expect(page.getByText("Codex CLI")).toBeVisible();

    await page.getByRole("tab", { name: "模型 API" }).click();
    await expect(page.getByText("启用模型 API")).toBeVisible();
    await expect(page.getByRole("button", { name: "保存配置" })).toBeVisible();

    await page.getByRole("button", { name: "账号与权限" }).click();
    await expect(page.getByText("登录手机号")).toBeVisible();
    await expect(page.getByText("已开通模块")).toBeVisible();

    await page.getByRole("button", { name: "关于与帮助" }).click();
    await expect(page.getByText("复制诊断信息")).toBeVisible();
    await expect(page.getByText("模拟管理员视图（原型）")).toBeVisible();
  });
});
