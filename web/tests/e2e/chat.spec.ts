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
    await expect(
      page.locator(".bubble-user").filter({ hasText: question }),
    ).toBeVisible();
    await expect(page.getByText("这是原型环境的模拟回复")).toBeVisible();
    await expect(page.getByLabel("执行中")).toHaveCount(0);
  });

  test("opens the attachment file picker from the composer menu", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "更多", exact: true }).click();

    const fileChooserPromise = page.waitForEvent("filechooser", {
      timeout: 3_000,
    });
    await page.getByRole("button", { name: "上传附件" }).click();

    await expect(fileChooserPromise).resolves.toBeTruthy();
  });

  test("shows selected attachments in the composer", async ({ page }) => {
    await page.getByRole("button", { name: "更多", exact: true }).click();

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "上传附件" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([
      {
        name: "market-report.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.alloc(1536),
      },
      {
        name: "库存数据.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: Buffer.alloc(2_098_176),
      },
    ]);

    await expect(page.getByText("market-report.pdf")).toBeVisible();
    await expect(page.getByText("1.5 KB")).toBeVisible();
    await expect(page.getByText("库存数据.xlsx")).toBeVisible();
    await expect(page.getByText("2 MB")).toBeVisible();

    await page.getByRole("button", { name: "移除附件 market-report.pdf" }).click();
    await expect(page.getByText("market-report.pdf")).toHaveCount(0);
    await expect(page.getByText("库存数据.xlsx")).toBeVisible();
  });

  test("renders selected image attachments as thumbnails", async ({ page }) => {
    const png1x1 = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lB3W1wAAAABJRU5ErkJggg==",
      "base64",
    );

    await page.getByRole("button", { name: "更多", exact: true }).click();
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "上传附件" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([
      {
        name: "price-chart.png",
        mimeType: "image/png",
        buffer: png1x1,
      },
    ]);

    const image = page.locator('.chat-composer img[alt="price-chart.png"]');
    await expect(image).toBeVisible();
    await expect
      .poll(() =>
        image.evaluate((el) =>
          el instanceof HTMLImageElement ? el.naturalWidth : 0,
        ),
      )
      .toBeGreaterThan(0);
  });

  test("uploads attachments before sending a message", async ({ page }) => {
    const uploads: Array<{
      url: string;
      headers: Record<string, string>;
      body: string;
    }> = [];
    await page.route("**/api/sessions/*/attachments", async (route) => {
      const request = route.request();
      const body = request.postDataBuffer();
      uploads.push({
        url: request.url(),
        headers: request.headers(),
        body: body?.toString("utf8") ?? "",
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "attachment-market-report",
          name: "market-report.txt",
          size: 24,
          mimeType: "text/plain",
          path: "D:\\tmp\\attachments\\market-report.txt",
          isImage: false,
          textContent: "库存环比下降 2.3%",
        }),
      });
    });

    await page.getByRole("button", { name: "更多", exact: true }).click();
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "上传附件" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([
      {
        name: "market-report.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("库存环比下降 2.3%", "utf8"),
      },
    ]);

    await page.getByPlaceholder(/可向助手询问任何事/).fill("请分析附件");
    await page.getByRole("button", { name: "发送" }).click();

    await page.waitForURL(/\/chat\/\d+/);
    await expect(
      page.locator(".bubble-user").filter({ hasText: "请分析附件" }),
    ).toBeVisible();
    await expect(page.getByText("market-report.txt")).toBeVisible();
    await expect.poll(() => uploads.length).toBe(1);
    expect(uploads[0].url).toContain("/api/sessions/");
    expect(uploads[0].headers["x-jlc-upload-mode"]).toBe("raw");
    expect(decodeURIComponent(uploads[0].headers["x-jlc-file-name"] ?? "")).toBe(
      "market-report.txt",
    );
    expect(uploads[0].headers["content-type"]).toBe("text/plain");
    expect(uploads[0].body).toContain("库存环比下降 2.3%");
  });

  test("shows uploading state and prevents duplicate attachment sends", async ({
    page,
  }) => {
    let uploadCount = 0;
    let releaseUpload!: () => void;
    const uploadStarted = new Promise<void>((resolve) => {
      page.route("**/api/sessions/*/attachments", async (route) => {
        uploadCount += 1;
        resolve();
        await new Promise<void>((release) => {
          releaseUpload = release;
        });
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "attachment-market-report",
            name: "market-report.txt",
            size: 24,
            mimeType: "text/plain",
            path: "D:\\tmp\\attachments\\market-report.txt",
            isImage: false,
          }),
        });
      });
    });

    await page.getByRole("button", { name: "更多", exact: true }).click();
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "上传附件" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([
      {
        name: "market-report.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("库存环比下降 2.3%", "utf8"),
      },
    ]);

    await page.getByPlaceholder(/可向助手询问任何事/).fill("请分析附件");
    const sendButton = page.getByRole("button", { name: "发送" });
    await sendButton.click();
    await uploadStarted;
    await sendButton.click({ force: true });

    await expect(sendButton).toBeDisabled();
    expect(uploadCount).toBe(1);

    releaseUpload();
    await page.waitForURL(/\/chat\/\d+/);
    await expect.poll(() => uploadCount).toBe(1);
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

    await expect(page.locator(".bubble-user").filter({ hasText: "第 1 轮问题" })).toBeVisible();
    await expect(page.locator(".chat-turn")).toHaveCount(18);

    await page.evaluate(() => {
      const root = document.querySelector(".chat-scroll-root");
      const target = document.querySelector('[data-turn-id="scroll-user-10"]');
      if (!(root instanceof HTMLElement)) return;
      if (!(target instanceof HTMLElement)) return;
      root.scrollTop = target.offsetTop;
      root.dispatchEvent(new Event("scroll"));
    });
    await expect(page.locator(".bubble-user").filter({ hasText: "第 10 轮问题" })).toBeVisible();
    await expect(page.locator(".chat-turn")).toHaveCount(18);
    const stickyState = await page.evaluate(() => {
      const root = document.querySelector(".chat-scroll-root");
      const active = document.querySelector(
        '.chat-turn[data-active-turn="true"] .chat-turn-user-panel',
      );
      if (!(root instanceof HTMLElement) || !(active instanceof HTMLElement)) {
        return null;
      }
      const rootTop = root.getBoundingClientRect().top;
      const activeTop = active.getBoundingClientRect().top;
      const computed = window.getComputedStyle(active);
      return {
        position: computed.position,
        offset: Math.round(activeTop - rootTop),
        text: active.textContent ?? "",
      };
    });
    expect(stickyState).toMatchObject({ position: "sticky" });
    expect(stickyState?.offset).toBeGreaterThanOrEqual(10);
    expect(stickyState?.offset).toBeLessThanOrEqual(40);

    await page.evaluate(() => {
      const root = document.querySelector(".chat-scroll-root");
      if (!(root instanceof HTMLElement)) return;
      root.scrollTop = root.scrollHeight;
      root.dispatchEvent(new Event("scroll"));
    });
    await expect(page.locator(".bubble-user").filter({ hasText: "第 18 轮问题" })).toBeVisible();

    await page.evaluate(() => {
      const root = document.querySelector(".chat-scroll-root");
      if (!(root instanceof HTMLElement)) return;
      root.scrollTop = 0;
      root.dispatchEvent(new Event("scroll"));
    });
    await expect(page.locator(".bubble-user").filter({ hasText: "第 1 轮问题" })).toBeVisible();
  });

  test("persists committed outline edits after refresh", async ({ page }) => {
    const sessionId = `outline-commit-recovery-${Date.now()}`;
    const storageKey = `jlc-chat-messages-${sessionId}`;

    await page.addInitScript(([seedSessionId, seedStorageKey]) => {
      const messages = [
        {
          id: "outline-user",
          role: "user",
          content: "请按大纲生成一份行业深度报告",
          status: "complete",
        },
        {
          id: "outline-assistant",
          role: "assistant",
          content: "",
          status: "complete",
          parts: [
            {
              id: "outline-part",
              kind: "writing_outline",
              title: "写作大纲",
              markdown:
                "## 原始大纲\n\n1. 市场回顾\n- 需求恢复\n\n2. 风险研判\n- 价格波动",
              outline: {
                version: 1,
                source: "ai",
                committed: false,
                sections: [
                  {
                    id: "section-1",
                    title: "市场回顾",
                    bullets: ["需求恢复"],
                  },
                  {
                    id: "section-2",
                    title: "风险研判",
                    bullets: ["价格波动"],
                  },
                ],
              },
            },
          ],
        },
      ];
      window.localStorage.setItem(seedStorageKey, JSON.stringify(messages));
      window.localStorage.setItem(`jlc-chat-started-${seedSessionId}`, "1");
    }, [sessionId, storageKey]);

    await page.goto(`/chat/${sessionId}`);
    await expect(page.getByText("写作大纲")).toBeVisible();

    await page
      .locator('input[value="写作大纲"]')
      .fill("用户确认版行业深度报告大纲");
    await page
      .locator('input[value="市场回顾"]')
      .fill("上半年市场复盘");
    await page.locator('input[value="需求恢复"]').fill("汽柴油需求分化");
    await page.getByRole("button", { name: "新增一节" }).click();
    await page.locator('input[value="新章节 3"]').fill("新增行动建议");
    await page.getByRole("button", { name: "确认采用" }).click();

    await expect(page.getByText("已确认")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate((key) => {
          const raw = window.localStorage.getItem(key);
          if (!raw) return null;
          const messages = JSON.parse(raw);
          const part = messages
            .flatMap((message: { parts?: unknown[] }) => message.parts ?? [])
            .find(
              (item: { id?: string; kind?: string }) =>
                item.id === "outline-part" && item.kind === "writing_outline",
            );
          return part ?? null;
        }, storageKey),
      )
      .toMatchObject({
        outline: {
          source: "user",
          committed: true,
          sections: expect.arrayContaining([
            expect.objectContaining({
              title: "上半年市场复盘",
              bullets: expect.arrayContaining(["汽柴油需求分化"]),
            }),
            expect.objectContaining({
              title: "新增行动建议",
            }),
          ]),
        },
      });

    await page.reload();
    await expect(page.getByText("已确认")).toBeVisible();
    await expect(page.getByText("用户确认版行业深度报告大纲")).toBeVisible();
    await expect(page.getByText("上半年市场复盘")).toBeVisible();
    await expect(page.getByText("新增行动建议")).toBeVisible();
  });

  test("opens workspace file links from markdown in the right workspace pane", async ({
    page,
  }) => {
    const sessionId = `workspace-link-open-${Date.now()}`;

    await page.addInitScript(([seedSessionId]) => {
      const messages = [
        {
          id: "workspace-link-user",
          role: "user",
          content: "打开结果文件",
          status: "complete",
        },
        {
          id: "workspace-link-assistant",
          role: "assistant",
          content: "结果文件： [docs/product/PRD-小窗.md](../../../docs/product/PRD-小窗.md)",
          status: "complete",
        },
      ];
      window.localStorage.setItem(
        `jlc-chat-messages-${seedSessionId}`,
        JSON.stringify(messages),
      );
    }, [sessionId]);

    await page.goto(`/chat/${sessionId}`);
    await expect(page.getByText("结果文件：")).toBeVisible();

    await page.getByRole("link", { name: "docs/product/PRD-小窗.md" }).click();

    await expect(
      page.getByRole("complementary", { name: "工作区" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "PRD-小窗.md" }).first(),
    ).toBeVisible();
    await expect(
      page.getByTitle("docs/product/PRD-小窗.md", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Preview")).toBeVisible();
  });
});
