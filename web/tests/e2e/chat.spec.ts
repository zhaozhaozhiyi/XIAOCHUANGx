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

function buildActivitySessionMessages() {
  const activityParts = Array.from({ length: 14 }, (_, index) => {
    const step = index + 1;
    const family = index % 3;
    const action =
      family === 0
        ? {
            id: `activity-read-${step}`,
            zone: "activity",
            kind: "file_read",
            path: `src/feature-${step}.ts`,
            streamSeq: step * 3 + 1,
          }
        : family === 1
          ? {
              id: `activity-edit-${step}`,
              zone: "activity",
              kind: "file_edit",
              path: `src/feature-${step}.ts`,
              streamSeq: step * 3 + 1,
            }
          : {
              id: `activity-command-${step}`,
              zone: "activity",
              kind: "command",
              command: `pnpm test --filter feature-${step}`,
              streamSeq: step * 3 + 1,
            };
    return [
      {
        id: `activity-stage-${step}`,
        zone: "activity",
        kind: "status",
        label: `阶段 ${String(step).padStart(2, "0")}：${family === 0 ? "读取" : family === 1 ? "编辑" : "验证"}`,
        streamSeq: step * 3,
      },
      action,
    ];
  }).flat();

  return [
    {
      id: "activity-user",
      role: "user",
      content: "请检查实现、完成修改并验证结果",
      status: "complete",
    },
    {
      id: "activity-assistant",
      role: "assistant",
      content: "## 最终结果\n\n修改和验证已经完成。",
      status: "complete",
      activityCollapse: "user_collapsed",
      parts: [
        ...activityParts,
        {
          id: "activity-narration",
          zone: "activity",
          kind: "narration",
          markdown: "我已经完成读取与验证，准备给出结论。",
          streamSeq: 99,
        },
        {
          id: "activity-reasoning",
          zone: "activity",
          kind: "reasoning",
          markdown: "只应在思考过程中出现的推理载荷",
          streamSeq: 100,
        },
        {
          id: "activity-result",
          zone: "summary",
          kind: "summary",
          markdown: "## 最终结果\n\n修改和验证已经完成。",
          streamSeq: 101,
        },
        {
          id: "activity-meta",
          zone: "activity",
          kind: "turn_meta",
          label: "已完成",
          durationMs: 42_000,
          runStatus: "complete",
          streamSeq: 102,
        },
      ],
    },
  ];
}

function buildRunningStickyMessages() {
  const paragraphs = Array.from(
    { length: 48 },
    (_, index) => `运行中正文 ${String(index + 1).padStart(2, "0")}：持续输出用于验证长回答中的状态可见性。`,
  ).join("\n\n");
  return [
    {
      id: "sticky-user",
      role: "user",
      content:
        "请检查一份较长的实现并持续报告当前阶段。这个问题故意写得较长，用于验证多行用户问题与处理摘要组成 sticky 栈时不会重叠。",
      status: "complete",
      attachments: [
        {
          id: "sticky-attachment",
          name: "implementation-notes.md",
          size: 4096,
          mimeType: "text/markdown",
        },
      ],
    },
    {
      id: "sticky-assistant",
      role: "assistant",
      content: paragraphs,
      status: "streaming",
      activityCollapse: "user_collapsed",
      parts: [
        {
          id: "sticky-stage",
          zone: "activity",
          kind: "status",
          label: "正在验证修改",
          phase: "verify",
          streamSeq: 1,
        },
        {
          id: "sticky-read",
          zone: "activity",
          kind: "file_read",
          path: "src/current.ts",
          streamSeq: 2,
        },
        {
          id: "sticky-edit",
          zone: "activity",
          kind: "file_edit",
          path: "src/current.ts",
          streamSeq: 3,
        },
        {
          id: "sticky-command",
          zone: "activity",
          kind: "command",
          command: "pnpm test",
          streaming: true,
          streamSeq: 4,
        },
        {
          id: "sticky-answer",
          zone: "summary",
          kind: "text",
          markdown: paragraphs,
          streaming: true,
          streamSeq: 5,
        },
      ],
    },
  ];
}

function buildMobileErrorMessages() {
  return [
    {
      id: "mobile-error-user",
      role: "user",
      content: "请读取、修改并验证这些文件",
      status: "complete",
    },
    {
      id: "mobile-error-assistant",
      role: "assistant",
      content: "## 部分结果\n\n已完成读取和第一轮修改。",
      status: "error",
      activityCollapse: "user_collapsed",
      parts: [
        {
          id: "mobile-error-stage",
          zone: "activity",
          kind: "status",
          label: "验证失败",
          phase: "verify",
          streamSeq: 1,
        },
        {
          id: "mobile-error-read",
          zone: "activity",
          kind: "file_read",
          path: "src/a.ts",
          streamSeq: 2,
        },
        {
          id: "mobile-error-edit",
          zone: "activity",
          kind: "file_edit",
          path: "src/a.ts",
          streamSeq: 3,
        },
        {
          id: "mobile-error-command",
          zone: "activity",
          kind: "tool",
          tool: "Bash",
          status: "error",
          message: "测试失败",
          input: { command: "pnpm test" },
          streamSeq: 4,
        },
        {
          id: "mobile-error-detail",
          zone: "activity",
          kind: "error",
          message: "测试命令返回非零退出码",
          streamSeq: 5,
        },
        {
          id: "mobile-error-answer",
          zone: "summary",
          kind: "summary",
          markdown: "## 部分结果\n\n已完成读取和第一轮修改。",
          streamSeq: 6,
        },
        {
          id: "mobile-error-meta",
          zone: "activity",
          kind: "turn_meta",
          durationMs: 42_000,
          runStatus: "error",
          streamSeq: 7,
        },
      ],
    },
  ];
}

test.describe("MVP chat", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedSession(page);
    await page.goto("/chat");
    await expect(
      page.getByRole("main").getByRole("heading", {
        name: "今天要处理什么？",
      }),
    ).toBeVisible();
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

  test("does not apply mock agent status while runtime detection is pending", async ({
    page,
  }) => {
    await page.route("**/api/agents", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      await route.continue();
    });
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: [
          `data: ${JSON.stringify({
            choices: [{ delta: { content: "Claude 请求已进入服务端" } }],
          })}`,
          "data: [DONE]",
          "",
        ].join("\n\n"),
      });
    });
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "jlc-research-settings-v2",
        JSON.stringify({
          executionSource: "cli",
          defaultAgentId: "claude",
          agentModels: { claude: "default" },
        }),
      );
    });

    await page.reload();
    await expect(
      page.getByRole("button", { name: /选择执行源与模型/ }),
    ).toHaveAttribute("title", /Claude Code/);

    await page
      .getByPlaceholder(/可向助手询问任何事/)
      .fill("在运行时探测完成前发送");
    await page.getByRole("button", { name: "发送" }).click();

    await page.waitForURL(/\/chat\/\d+/);
    await expect(page.getByText("Claude 请求已进入服务端")).toBeVisible();
    await expect(page.getByText(/Claude Code 需要先完成登录/)).toHaveCount(0);
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

  test("keeps the composer layout stable near the wrap boundary", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 480, height: 320 });
    const composer = page.locator(".chat-composer:visible").first();
    const textarea = composer.locator(".chat-composer__textarea");
    const body = composer.locator(".chat-composer__body");

    await textarea.fill(`${"速度".repeat(11)}d f`);
    await expect(body).toHaveClass(/chat-composer__body--stacked/);

    const samples: Array<{ mode: string; height: number }> = [];
    const sample = async () => {
      samples.push(
        await composer.evaluate((node) => {
          const body = node.querySelector(".chat-composer__body");
          return {
            mode: body?.classList.contains("chat-composer__body--stacked")
              ? "stacked"
              : "inline",
            height: Math.round(node.getBoundingClientRect().height),
          };
        }),
      );
    };

    await sample();
    for (let i = 0; i < 4; i += 1) {
      await textarea.type("x");
      await sample();
      await textarea.press("Backspace");
      await sample();
    }

    expect(new Set(samples.map((state) => state.mode))).toEqual(
      new Set(["stacked"]),
    );
    expect(new Set(samples.map((state) => state.height)).size).toBe(1);
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
    await page.goto("/chat/history");
    await page.waitForURL("**/chat/history");
    await expect(page.getByRole("heading", { name: "历史会话" })).toBeVisible();
    await page
      .getByRole("main")
      .getByRole("link", { name: /螺纹钢社会库存环比分析/ })
      .click();
    await page.waitForURL("**/chat/1");
    await expect(
      page.locator(".bubble-user").filter({
        hasText: "上周螺纹钢社会库存环比变化是多少？",
      }),
    ).toBeVisible();
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

  test("separates process from result and preserves disclosure scroll position", async ({
    page,
  }) => {
    const sessionId = `activity-layout-${Date.now()}`;
    const storageKey = `jlc-chat-messages-${sessionId}`;
    await page.addInitScript(
      ([seedSessionId, messages]) => {
        const key = `jlc-chat-messages-${seedSessionId}`;
        if (window.localStorage.getItem(key)) return;
        window.localStorage.setItem(
          key,
          JSON.stringify(messages),
        );
        window.localStorage.setItem(`jlc-chat-started-${seedSessionId}`, "1");
      },
      [sessionId, buildActivitySessionMessages()],
    );

    await page.setViewportSize({ width: 980, height: 680 });
    await page.goto(`/chat/${sessionId}`);

    const root = page.locator(".chat-scroll-root");
    const process = page.getByTestId("activity-section");
    const summary = process.locator(".chat-activity-summary");
    const result = page.getByTestId("result-sequence");
    await expect(summary).toBeVisible();
    await expect(summary).toHaveAccessibleName(/展开处理过程/);
    await expect(process.getByTestId("activity-evidence-list")).toHaveCount(0);
    await expect(process.getByTestId("activity-narration-preview")).toContainText(
      "准备给出结论",
    );
    await expect(page.getByText("只应在思考过程中出现的推理载荷")).toHaveCount(0);

    const order = await page.evaluate(() => {
      const processElement = document.querySelector('[data-testid="activity-section"]');
      const resultElement = document.querySelector('[data-testid="result-sequence"]');
      if (!(processElement instanceof HTMLElement) || !(resultElement instanceof HTMLElement)) {
        return null;
      }
      return processElement.compareDocumentPosition(resultElement);
    });
    expect(order == null ? false : Boolean(order & 4)).toBe(true);

    await root.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll"));
    });
    const topBefore = await summary.evaluate((element) => {
      const rootElement = element.closest(".chat-scroll-root");
      if (!(rootElement instanceof HTMLElement)) return null;
      return element.getBoundingClientRect().top - rootElement.getBoundingClientRect().top;
    });

    await summary.click();
    await expect(process.getByTestId("activity-evidence-list")).toBeVisible();
    await expect(process.getByTestId("activity-narration-preview")).toHaveCount(0);
    await expect(process.getByText("我已经完成读取与验证，准备给出结论。")).toBeVisible();
    await page.waitForTimeout(100);
    const topAfter = await summary.evaluate((element) => {
      const rootElement = element.closest(".chat-scroll-root");
      if (!(rootElement instanceof HTMLElement)) return null;
      return element.getBoundingClientRect().top - rootElement.getBoundingClientRect().top;
    });
    expect(topBefore).not.toBeNull();
    expect(topAfter).not.toBeNull();
    expect(Math.abs((topAfter ?? 0) - (topBefore ?? 0))).toBeLessThanOrEqual(2);
    await expect(page.getByRole("button", { name: "回到底部" })).toBeVisible();

    await process.getByRole("button", { name: /更早 6 个步骤/ }).click();
    const labels = await process
      .locator(".chat-activity-evidence__stage")
      .allTextContents();
    expect(labels[0]).toContain("阶段 01：读取");
    expect(labels[1]).toContain("阶段 02：编辑");
    expect(labels[2]).toContain("阶段 03：验证");

    await process.getByTestId("activity-thinking-toggle").click();
    await expect(page.getByText("只应在思考过程中出现的推理载荷")).toBeVisible();
    await process.getByRole("button", { name: "技术详情" }).click();
    await expect(page.getByText("只应在思考过程中出现的推理载荷")).toHaveCount(1);
    await expect
      .poll(() =>
        page.evaluate((key) => {
          const raw = window.localStorage.getItem(key);
          if (!raw) return null;
          const messages = JSON.parse(raw);
          return messages.find(
            (message: { id?: string }) => message.id === "activity-assistant",
          )?.activityCollapse;
        }, storageKey),
      )
      .toBe("user_expanded");

    await page.reload();
    await expect(page.getByTestId("activity-evidence-list")).toBeVisible();
    await expect(result).toContainText("最终结果");
    await summary.focus();
    await summary.press("Enter");
    await expect(summary).toHaveAttribute("aria-expanded", "false");
    await expect(summary).toBeFocused();
  });

  test("preserves a visible markdown block when canonical final replaces provisional text", async ({
    page,
  }) => {
    const sessionId = `answer-reconcile-${Date.now()}`;
    const runId = "answer-reconcile-run";
    const sharedParagraphs = Array.from(
      { length: 72 },
      (_, index) => `共同段落 ${String(index + 1).padStart(2, "0")}：这是用于验证阅读锚点的稳定正文。`,
    );
    const provisional = ["# 临时分析", ...sharedParagraphs].join("\n\n");
    const final = [
      "# 最终分析",
      "新增结论 A：正式答案补充了前置判断。",
      "新增结论 B：正式答案补充了风险边界。",
      "新增结论 C：正式答案补充了验证口径。",
      ...sharedParagraphs,
      "最终建议：按正式口径执行。",
    ].join("\n\n");
    let completeRun = false;
    const now = new Date().toISOString();

    const canonicalOutput = {
      protocolVersion: 1,
      sessionId,
      turnId: "answer-reconcile-assistant",
      runId,
      provider: { agentId: "codex", providerId: "codex" },
      outcome: { status: "success", finishedAt: Date.now(), durationMs: 42_000 },
      finalAnswer: { markdown: final },
      nextAction: { type: "none" },
    };
    const events = () => [
      {
        type: "run.started",
        runId,
        cwd: "/tmp/project",
        agentId: "codex",
      },
      {
        type: "run.status",
        runId,
        phase: "analyze",
        label: "正在分析",
      },
      {
        type: "part.append",
        runId,
        part: {
          id: "answer-reconcile-read",
          zone: "activity",
          kind: "file_read",
          path: "src/analysis.ts",
        },
      },
      {
        type: "message.delta",
        runId,
        turnId: "answer-reconcile-assistant",
        text: provisional,
      },
      ...(completeRun
        ? [
            { type: "canonical.output", runId, canonicalOutput },
            { type: "run.finished", runId },
          ]
        : []),
    ];

    await page.route(
      new RegExp(`/api/runs/${runId}$`),
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            runId,
            tenantId: "test",
            projectId: "test",
            workspaceId: "test",
            sessionId,
            turnId: "answer-reconcile-assistant",
            agentId: "codex",
            agentModel: "mock",
            status: completeRun ? "completed" : "running",
            queuePolicy: "interrupt",
            createdAt: now,
            startedAt: now,
            ...(completeRun
              ? { finishedAt: now, canonicalOutput }
              : {}),
          }),
        });
      },
    );
    await page.route(
      new RegExp(`/api/runs/${runId}/events$`),
      async (route) => {
        const items = events();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ runId, items, count: items.length }),
        });
      },
    );
    await page.addInitScript(
      ([seedSessionId, seedRunId]) => {
        window.localStorage.setItem(
          `jlc-chat-messages-${seedSessionId}`,
          JSON.stringify([
            {
              id: "answer-reconcile-user",
              role: "user",
              content: "请给出一份长分析",
              status: "complete",
            },
            {
              id: "answer-reconcile-assistant",
              role: "assistant",
              content: "",
              status: "streaming",
              runId: seedRunId,
              parts: [],
            },
          ]),
        );
        window.localStorage.setItem(`jlc-chat-started-${seedSessionId}`, "1");
      },
      [sessionId, runId],
    );

    await page.setViewportSize({ width: 980, height: 620 });
    await page.goto(`/chat/${sessionId}`);
    const answer = page.locator('[data-answer-id="answer-reconcile-assistant-answer"]');
    await expect(answer).toHaveAttribute("data-answer-phase", "provisional");
    await expect(answer).toContainText("共同段落 30");

    const scrollRoot = page.locator(".chat-scroll-root");
    const rootBox = await scrollRoot.boundingBox();
    expect(rootBox).not.toBeNull();
    await page.mouse.move(
      (rootBox?.x ?? 0) + (rootBox?.width ?? 0) / 2,
      (rootBox?.y ?? 0) + (rootBox?.height ?? 0) / 2,
    );
    await page.mouse.wheel(0, -900);
    await expect(page.getByRole("button", { name: "回到底部" })).toBeVisible();
    const anchorBefore = await page.evaluate(() => {
      const root = document.querySelector(".chat-scroll-root");
      if (!(root instanceof HTMLElement)) return null;
      const rootRect = root.getBoundingClientRect();
      const paragraph = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-answer-id="answer-reconcile-assistant-answer"] [data-scroll-anchor]',
        ),
      ).find((element) => {
        const rect = element.getBoundingClientRect();
        return rect.bottom > rootRect.top && rect.top < rootRect.bottom;
      });
      if (!paragraph) return null;
      return {
        id: paragraph.dataset.scrollAnchor,
        top: paragraph.getBoundingClientRect().top - rootRect.top,
        distance: root.scrollHeight - root.scrollTop - root.clientHeight,
      };
    });
    expect(anchorBefore?.id).toBeTruthy();
    expect(anchorBefore?.distance ?? 0).toBeGreaterThan(200);

    completeRun = true;
    await expect(answer).toHaveAttribute("data-answer-phase", "final", {
      timeout: 15_000,
    });
    await expect(answer).toContainText("新增结论 C");
    const anchorAfter = await page.evaluate((anchorId) => {
      const root = document.querySelector(".chat-scroll-root");
      const paragraph = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-answer-id="answer-reconcile-assistant-answer"] [data-scroll-anchor]',
        ),
      ).find((element) => element.dataset.scrollAnchor === anchorId);
      if (!(root instanceof HTMLElement) || !paragraph) return null;
      return paragraph.getBoundingClientRect().top - root.getBoundingClientRect().top;
    }, anchorBefore?.id);
    expect(anchorAfter).not.toBeNull();
    expect(Math.abs((anchorAfter ?? 0) - (anchorBefore?.top ?? 0))).toBeLessThanOrEqual(2);
  });

  test("keeps the running process summary below the sticky user question", async ({
    page,
  }) => {
    const sessionId = `running-sticky-${Date.now()}`;
    await page.addInitScript(
      ([seedSessionId, messages]) => {
        window.localStorage.setItem(
          `jlc-chat-messages-${seedSessionId}`,
          JSON.stringify(messages),
        );
        window.localStorage.setItem(`jlc-chat-started-${seedSessionId}`, "1");
      },
      [sessionId, buildRunningStickyMessages()],
    );

    await page.setViewportSize({ width: 980, height: 620 });
    await page.goto(`/chat/${sessionId}`);
    const root = page.locator(".chat-scroll-root");
    const rootBox = await root.boundingBox();
    expect(rootBox).not.toBeNull();
    await page.mouse.move(
      (rootBox?.x ?? 0) + (rootBox?.width ?? 0) / 2,
      (rootBox?.y ?? 0) + (rootBox?.height ?? 0) / 2,
    );
    await page.mouse.wheel(0, -900);

    const sticky = await page.evaluate(() => {
      const rootElement = document.querySelector(".chat-scroll-root");
      const turn = document.querySelector('[data-turn-id="sticky-user"]');
      const user = turn?.querySelector<HTMLElement>(".chat-turn-user-panel");
      const stickyBar = turn?.querySelector<HTMLElement>(
        ".chat-activity-section__sticky-bar",
      );
      const summary = turn?.querySelector<HTMLElement>(".chat-activity-summary");
      const assistant = turn?.querySelector<HTMLElement>(".chat-turn-assistant");
      if (
        !(rootElement instanceof HTMLElement) ||
        !user ||
        !stickyBar ||
        !summary ||
        !assistant
      ) {
        return null;
      }
      const rootRect = rootElement.getBoundingClientRect();
      const userRect = user.getBoundingClientRect();
      const summaryRect = summary.getBoundingClientRect();
      const assistantRect = assistant.getBoundingClientRect();
      return {
        processPosition: getComputedStyle(stickyBar).position,
        userPosition: getComputedStyle(user).position,
        userTop: userRect.top - rootRect.top,
        userBottom: userRect.bottom - rootRect.top,
        summaryTop: summaryRect.top - rootRect.top,
        summaryBottom: summaryRect.bottom - rootRect.top,
        assistantBottom: assistantRect.bottom - rootRect.top,
      };
    });
    expect(sticky).not.toBeNull();
    expect(sticky?.processPosition).toBe("sticky");
    expect(sticky?.userPosition).toBe("sticky");
    expect(sticky?.summaryTop ?? 0).toBeGreaterThanOrEqual((sticky?.userBottom ?? 0) + 4);
    expect(sticky?.summaryBottom ?? 0).toBeLessThanOrEqual(sticky?.assistantBottom ?? 0);
    await expect(page.getByTestId("activity-section")).toHaveAttribute("data-state", "running");
  });

  test("prioritizes failure state on narrow screens and keeps outcome before partial result", async ({
    page,
  }) => {
    const sessionId = `mobile-error-${Date.now()}`;
    await page.addInitScript(
      ([seedSessionId, messages]) => {
        window.localStorage.setItem(
          `jlc-chat-messages-${seedSessionId}`,
          JSON.stringify(messages),
        );
        window.localStorage.setItem(`jlc-chat-started-${seedSessionId}`, "1");
      },
      [sessionId, buildMobileErrorMessages()],
    );

    await page.setViewportSize({ width: 390, height: 720 });
    await page.goto(`/chat/${sessionId}`);
    const process = page.getByTestId("activity-section");
    const summary = process.locator(".chat-activity-summary");
    await expect(process).toHaveAttribute("data-state", "error");
    await expect(summary).toContainText("验证失败");
    await expect(summary).toContainText("失败");
    const summaryLayout = await summary.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      width: element.getBoundingClientRect().width,
      scrollWidth: element.scrollWidth,
      visibleSegments: Array.from(
        element.querySelectorAll<HTMLElement>(".chat-activity-summary__segment"),
      ).filter((segment) => getComputedStyle(segment).display !== "none").length,
    }));
    expect(summaryLayout.height).toBeLessThanOrEqual(40);
    expect(summaryLayout.scrollWidth).toBeLessThanOrEqual(summaryLayout.width + 1);
    expect(summaryLayout.visibleSegments).toBeLessThanOrEqual(2);

    const outcome = page.locator('.chat-outcome-callout[data-kind="error"]');
    await expect(outcome).toContainText("测试命令返回非零退出码");
    await expect(outcome).toContainText("以下为已生成的部分结果");
    const outcomeBeforeResult = await page.evaluate(() => {
      const outcomeElement = document.querySelector(
        '.chat-outcome-callout[data-kind="error"]',
      );
      const resultElement = document.querySelector('[data-testid="result-sequence"]');
      if (!(outcomeElement instanceof HTMLElement) || !(resultElement instanceof HTMLElement)) {
        return false;
      }
      return Boolean(outcomeElement.compareDocumentPosition(resultElement) & 4);
    });
    expect(outcomeBeforeResult).toBe(true);
  });

  test("persists committed outline edits after refresh", async ({ page }) => {
    const sessionId = `outline-commit-recovery-${Date.now()}`;
    const storageKey = `jlc-chat-messages-${sessionId}`;

    await page.addInitScript(([seedSessionId, seedStorageKey]) => {
      if (window.localStorage.getItem(seedStorageKey)) return;
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
      window.localStorage.setItem(
        `jlc-chat-project-${seedSessionId}`,
        "proj-mengdian",
      );
      window.localStorage.setItem(`jlc-chat-started-${seedSessionId}`, "1");
    }, [sessionId]);

    const projectTreeReady = page.waitForResponse(
      (response) =>
        response.url().includes("/api/projects/proj-mengdian/tree") &&
        response.status() === 200,
    );
    await page.goto(`/chat/${sessionId}`);
    await expect(page.getByText("结果文件：")).toBeVisible();
    await expect(page.getByRole("main").getByText("蒙电十五五")).toBeVisible();
    await projectTreeReady;

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
