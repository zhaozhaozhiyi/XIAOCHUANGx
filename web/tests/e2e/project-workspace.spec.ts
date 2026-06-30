import { expect, test } from "@playwright/test";
import { seedAuthenticatedSession } from "./helpers";

test.describe("MVP project workspace", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedSession(page);
  });

  test("binds a local project and opens the workspace tree", async ({ page }) => {
    await page.goto("/chat");
    await expect(page.getByText("今天要处理什么？")).toBeVisible();

    await page.getByRole("button", { name: "选择工作文件夹" }).click();
    await page.getByRole("button", { name: "添加文件夹" }).click();

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
      page.getByRole("button", { name: /当前工作文件夹：E2E测试项目/ }),
    ).toBeVisible();
    await expect(page.getByText(/当前工作文件夹：~\/Projects\/e2e-demo/)).toBeVisible();

    await page.getByRole("button", { name: "展开工作区" }).click();
    await expect(
      page.getByRole("complementary", { name: "工作区" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "收起工作区" })).toBeVisible();
  });

  test("keeps selected project binding after creating a chat session", async ({
    page,
  }) => {
    await page.goto("/chat?project=proj-mengdian");
    await expect(page.getByText("今天要处理什么？")).toBeVisible();
    await expect(page.getByText(/当前工作文件夹：~\/Projects\/蒙电十五五/)).toBeVisible();

    await page
      .getByPlaceholder(/可向助手询问任何事|输入问题|继续提问/)
      .fill("请结合当前工作文件夹准备一份阶段进展说明");
    await page.getByRole("button", { name: "发送" }).click();

    await page.waitForURL(/\/chat\/\d+/);
    const sessionId = page.url().split("/").pop();
    expect(sessionId).toBeTruthy();
    const boundSessionId = sessionId!;
    await expect
      .poll(() =>
        page.evaluate(
          (currentId) =>
            window.localStorage.getItem(`jlc-chat-project-${currentId}`),
          boundSessionId,
        ),
      )
      .toBe("proj-mengdian");
  });
});
