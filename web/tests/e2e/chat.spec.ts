import { expect, test } from "@playwright/test";
import { seedAuthenticatedSession } from "./helpers";

const SCROLL_SESSION_ID = "scroll-check";

function buildLongSessionMessages(turnCount = 18) {
  return Array.from({ length: turnCount }, (_, index) => {
    const turn = index + 1;
    return [
      {
        id: `scroll-user-${turn}`,
        role: "user",
        content: `第 ${turn} 轮问题：请按研究员工作节奏总结当前进展，并说明下一步动作。`,
        status: "complete",
      },
      {
        id: `scroll-assistant-${turn}`,
        role: "assistant",
        content:
          `第 ${turn} 轮回复：已整理本轮上下文、执行步骤与下一步建议。` +
          " 当前输出应保持稳定，不因滚动而丢失，也不应在过程中突然重排。",
        status: "complete",
      },
    ];
  }).flat();
}

test.describe("MVP chat", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedSession(page);
    await page.goto("/chat");
    await expect(page.getByText("今天要处理什么？")).toBeVisible();
  });

  test("creates a new chat and receives a mock streamed reply", async ({
    page,
  }) => {
    const question = "请总结一下当前 MVP 的测试目标";
    await page.getByPlaceholder(/可向助手询问任何事/).fill(question);
    await page.getByRole("button", { name: "发送" }).click();

    await page.waitForURL(/\/chat\/\d+/);
    await expect(page.getByText(question)).toBeVisible();
    await expect(page.getByText("这是原型环境的模拟回复")).toBeVisible();
    await expect(page.getByLabel("执行中")).toHaveCount(0);
  });

  test("opens an existing seeded history session", async ({ page }) => {
    await page.getByRole("link", { name: /历史会话/ }).click();
    await page.waitForURL("**/chat/history");
    await page.getByRole("link", { name: /螺纹钢社会库存环比分析/ }).click();
    await page.waitForURL("**/chat/1");
    await expect(page.getByText("上周螺纹钢社会库存环比变化是多少？")).toBeVisible();
    await expect(page.getByText("据已接入数据源，上周螺纹钢社会库存环比下降 2.3%。")).toBeVisible();
  });

  test("keeps structured assistant sections and stable long-session scrolling", async ({
    page,
  }) => {
    await page.goto("/chat/2");
    await expect(page.getByText("执行结果")).toBeVisible();
    await expect(page.getByText("执行过程")).toBeVisible();
    await expect(page.getByText("最终回复")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /查看处理过程/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /技术详情/ })).toBeVisible();

    await page.addInitScript(
      ([sessionId, messages]) => {
        window.localStorage.setItem(
          `jlc-chat-messages-${sessionId}`,
          JSON.stringify(messages),
        );
      },
      [SCROLL_SESSION_ID, buildLongSessionMessages()],
    );

    await page.goto(`/chat/${SCROLL_SESSION_ID}`);
    await expect(page.locator(".chat-scroll-root")).toBeVisible();
    await page.waitForFunction(() => {
      const root = document.querySelector(".chat-scroll-root");
      return !!root && root.scrollHeight > root.clientHeight;
    });

    await expect(page.getByText("第 1 轮问题")).toBeVisible();
    await expect(page.locator(".chat-turn")).toHaveCount(18);

    await page.evaluate(() => {
      const root = document.querySelector(".chat-scroll-root");
      if (!(root instanceof HTMLElement)) return;
      root.scrollTop = Math.floor(root.scrollHeight * 0.55);
      root.dispatchEvent(new Event("scroll"));
    });
    await expect(page.getByText("第 10 轮问题")).toBeVisible();
    await expect(page.locator(".chat-turn")).toHaveCount(18);

    await page.evaluate(() => {
      const root = document.querySelector(".chat-scroll-root");
      if (!(root instanceof HTMLElement)) return;
      root.scrollTop = root.scrollHeight;
      root.dispatchEvent(new Event("scroll"));
    });
    await expect(page.getByText("第 18 轮问题")).toBeVisible();

    await page.evaluate(() => {
      const root = document.querySelector(".chat-scroll-root");
      if (!(root instanceof HTMLElement)) return;
      root.scrollTop = 0;
      root.dispatchEvent(new Event("scroll"));
    });
    await expect(page.getByText("第 1 轮问题")).toBeVisible();
  });
});
