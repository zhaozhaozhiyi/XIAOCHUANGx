import { expect, test } from "@playwright/test";
import { seedAuthenticatedSession } from "./helpers";

test.describe("MVP project workspace", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedSession(page);
    await page.goto("/chat");
    await expect(page.getByText("今天要处理什么？")).toBeVisible();
  });

  test("binds a local project and opens the workspace tree", async ({ page }) => {
    await page.getByRole("button", { name: "进入项目工作" }).click();
    await page.getByRole("button", { name: "添加新项目" }).click();

    await page
      .locator("label")
      .filter({ hasText: "项目名称" })
      .locator("input")
      .fill("E2E测试项目");
    await page
      .locator("label")
      .filter({ hasText: "文件夹路径" })
      .locator("input")
      .fill("~/Projects/e2e-demo");
    await page.getByRole("button", { name: "确认绑定" }).click();

    await expect(
      page.getByRole("button", { name: /当前项目：E2E测试项目/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: "展开工作区" }).click();
    await expect(page.getByLabel("工作区")).toBeVisible();
    await expect(page.getByLabel("文件目录")).toBeVisible();
    await expect(page.getByText("功能清单.md")).toBeVisible();
  });
});
