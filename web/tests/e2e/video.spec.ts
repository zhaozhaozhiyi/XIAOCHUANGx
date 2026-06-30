import { expect, test } from "@playwright/test";
import { seedAuthenticatedSession } from "./helpers";

test.describe("video module P0", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedSession(page);
  });

  test("starts a web video session and shows P0 deliverables", async ({
    page,
  }) => {
    await page.goto("/video/new");
    await expect(
      page.getByText("可预览、可录屏的网页视频项目"),
    ).toBeVisible();

    const input = page.getByPlaceholder(/可向助手询问任何事|输入问题|继续提问/);
    await input.fill("做一个 60s 小窗产品介绍视频，面向客户高层");
    await page.getByRole("button", { name: "发送" }).click();

    await page.waitForURL(/\/video\/\d+/);
    await expect(page.getByText("先补充一下这个视频的关键要求")).toBeVisible();

    await page.getByRole("button", { name: "产品介绍" }).click();
    await page.getByRole("button", { name: "客户高层" }).click();
    await page.getByPlaceholder("例如：60s、90s、3 分钟以内").fill("60s");
    await page.getByRole("button", { name: "16:9 横屏" }).click();
    await page
      .getByPlaceholder("例如：小窗能力、研究交付、数据图、品牌口径、Logo 路径")
      .fill("小窗能力、研究交付、网页视频预览和录屏路径");
    await expect(page.getByText("信息已齐备，提交后进入下一步")).toBeVisible();
    await page.getByRole("button", { name: "提交信息" }).click();

    await expect(page.getByText("视频需求摘要")).toBeVisible();
    await expect(page.getByText("视频网页 outline")).toBeVisible();
    await expect(page.getByText("presentation/ 网页视频项目")).toBeVisible();
    await expect(page.getByText("script.md 口播稿")).toBeVisible();
    await expect(page.getByText("outline.md 章节计划")).toBeVisible();
    await expect(page.getByRole("link", { name: /打开预览/ })).toHaveAttribute(
      "href",
      "http://localhost:5174/?reel=1",
    );
    await expect(page.getByRole("button", { name: "复制路径" }).first()).toBeVisible();
    await expect(page.getByText("录屏入口：http://localhost:5174/?auto=1")).toBeVisible();
    await expect(page.getByText("若预览打不开，先在项目目录运行：cd presentation && npm run dev")).toBeVisible();
  });
});
