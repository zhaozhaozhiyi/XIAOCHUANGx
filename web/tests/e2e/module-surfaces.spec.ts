import { expect, test } from "@playwright/test";
import { seedAuthenticatedSession } from "./helpers";

test.describe("module surfaces", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedSession(page);
  });

  test("opens writing surface and starts a writing session", async ({
    page,
  }) => {
    await page.goto("/writing/new");
    await expect(page.getByText("今天要写什么？")).toBeVisible();

    const input = page.getByPlaceholder(/可向助手询问任何事|输入问题|继续提问/);
    await input.fill("请帮我起草一份钢材市场周报大纲");
    await page.getByRole("button", { name: "发送" }).click();

    await page.waitForURL(/\/writing\/\d+/);
    await expect(
      page.locator(".bubble-user").filter({
        hasText: "请帮我起草一份钢材市场周报大纲",
      }),
    ).toBeVisible();
  });

  test("keeps the writing format menu inside the viewport", async ({
    page,
  }) => {
    await page.goto("/writing/new");
    await expect(page.getByText("今天要写什么？")).toBeVisible();

    await page
      .locator("[data-module-skill-picker]")
      .locator(".control-picker__main")
      .click();

    const menu = page.locator("[data-module-skill-menu]");
    await expect(menu).toBeVisible();
    await expect(menu).toContainText("研报、行业分析、一般文稿");
    await expect(menu).toContainText("通知、请示、报告、函件等");
    await expect(menu).toContainText("议题、决议与待办事项");

    const box = await menu.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();

    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.y).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);

    await menu.getByRole("button", { name: /公文/ }).click();
    await expect(menu).toHaveCount(0);
    await expect(
      page
        .locator("[data-module-skill-picker]")
        .locator(".control-picker__main"),
    ).toHaveText("公文");
  });

  test("opens ppt surface and starts a ppt session", async ({ page }) => {
    await page.goto("/ppt/new");
    await expect(page.getByText("今天要做什么演示？")).toBeVisible();

    const input = page.getByPlaceholder(/可向助手询问任何事|输入问题|继续提问/);
    await input.fill("请生成一份煤化工行业月度汇报的PPT结构");
    await page.getByRole("button", { name: "发送" }).click();

    await page.waitForURL(/\/ppt\/\d+/);
    await expect(
      page.locator(".bubble-user").filter({
        hasText: "请生成一份煤化工行业月度汇报的PPT结构",
      }),
    ).toBeVisible();
  });
});
