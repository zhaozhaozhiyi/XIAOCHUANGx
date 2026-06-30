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
