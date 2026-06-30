import { expect, test } from "@playwright/test";
import { seedAuthenticatedSession } from "./helpers";

async function seedDeliverableSession(
  page: import("@playwright/test").Page,
  {
    sessionId,
    route,
    projectId,
    filePath,
    buttonLabel,
  }: {
    sessionId: string;
    route: `/writing/${string}` | `/ppt/${string}`;
    projectId: string;
    filePath: string;
    buttonLabel: "生成 DOCX" | "系统打开";
  },
) {
  await page.addInitScript(
    ([seedSessionId, seedProjectId, deliverablePath]) => {
      const messages = [
        {
          id: `${seedSessionId}-user`,
          role: "user",
          content: "请生成交付物",
          status: "complete",
        },
        {
          id: `${seedSessionId}-assistant`,
          role: "assistant",
          content: "已生成交付物，请继续处理。",
          status: "complete",
          parts: [
            {
              id: `${seedSessionId}-deliverables`,
              zone: "summary",
              kind: "deliverables",
              headline: "交付物",
              primaryPath: deliverablePath,
              items: [
                {
                  path: deliverablePath,
                  label: deliverablePath.split("/").pop(),
                  kind: "primary",
                },
              ],
              completedAt: Date.now(),
            },
          ],
        },
      ];
      window.localStorage.setItem(
        `jlc-chat-messages-${seedSessionId}`,
        JSON.stringify(messages),
      );
      window.localStorage.setItem(
        `jlc-chat-project-${seedSessionId}`,
        seedProjectId,
      );
    },
    [sessionId, projectId, filePath],
  );

  await page.goto(route);
  await expect(page.getByRole("button", { name: buttonLabel })).toBeVisible();
}

test.describe("deliverables regression", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthenticatedSession(page);
  });

  test("generates writing docx into the bound local workspace", async ({
    page,
  }) => {
    const sessionId = "writing-deliverable-export";
    const filePath = "outputs/钢材周报.md";
    const projectId = "proj-mengdian";
    let requestBody = "";

    await seedDeliverableSession(page, {
      sessionId,
      route: `/writing/${sessionId}`,
      projectId,
      filePath,
      buttonLabel: "生成 DOCX",
    });

    await page.route("**/api/writing/export-docx", async (route) => {
      requestBody = route.request().postData() ?? "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          path: "outputs/钢材周报.docx",
          mime:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          size: 15,
        }),
      });
    });

    await page.getByRole("button", { name: "生成 DOCX" }).click();
    await expect(page.getByText("已生成 outputs/钢材周报.docx")).toBeVisible();

    expect(requestBody).toContain(`"filePath":"${filePath}"`);
    expect(requestBody).toContain(`"projectId":"${projectId}"`);
    expect(requestBody).toContain('"writeToWorkspace":true');
  });

  test("opens ppt deliverable through the desktop local file bridge", async ({
    page,
  }) => {
    const sessionId = "ppt-deliverable-download";
    const filePath = "outputs/monthly-review.pptx";
    const projectId = "proj-hermes";

    await page.addInitScript(() => {
      (window as typeof window & {
        __jlcOpenedPaths?: Array<{ projectId: string; path: string }>;
        electronAPI?: {
          isDesktop: boolean;
          pickAndImportFolder: () => Promise<{ ok: false; canceled: true }>;
          openPath: (input: { projectId: string; path: string }) => Promise<{ ok: boolean }>;
          showItemInFolder: (input: { projectId: string; path: string }) => Promise<{ ok: boolean }>;
        };
      }).__jlcOpenedPaths = [];
      (window as typeof window & {
        __jlcOpenedPaths?: Array<{ projectId: string; path: string }>;
        electronAPI?: {
          isDesktop: boolean;
          pickAndImportFolder: () => Promise<{ ok: false; canceled: true }>;
          openPath: (input: { projectId: string; path: string }) => Promise<{ ok: boolean }>;
          showItemInFolder: (input: { projectId: string; path: string }) => Promise<{ ok: boolean }>;
        };
      }).electronAPI = {
        isDesktop: true,
        pickAndImportFolder: async () => ({ ok: false, canceled: true }),
        openPath: async (input) => {
          (window as typeof window & {
            __jlcOpenedPaths?: Array<{ projectId: string; path: string }>;
          }).__jlcOpenedPaths?.push(input);
          return { ok: true };
        },
        showItemInFolder: async () => ({ ok: true }),
      };
    });

    await seedDeliverableSession(page, {
      sessionId,
      route: `/ppt/${sessionId}`,
      projectId,
      filePath,
      buttonLabel: "系统打开",
    });

    await page
      .getByRole("button", { name: "系统打开 monthly-review.pptx" })
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              window as typeof window & {
                __jlcOpenedPaths?: Array<{ projectId: string; path: string }>;
              }
            ).__jlcOpenedPaths?.[0] ?? null,
        ),
      )
      .toEqual({ projectId, path: filePath });
  });

  test("prefills composer for multi-turn iteration from a deliverable", async ({
    page,
  }) => {
    const sessionId = "writing-deliverable-iterate";
    const filePath = "outputs/钢材周报.md";
    const projectId = "proj-mengdian";

    await seedDeliverableSession(page, {
      sessionId,
      route: `/writing/${sessionId}`,
      projectId,
      filePath,
      buttonLabel: "生成 DOCX",
    });

    await page
      .getByRole("button", { name: "继续迭代 钢材周报.md" })
      .click();
    await expect(page.getByPlaceholder(/继续提问/)).toHaveValue(
      `请基于工作区文件 @${filePath} 继续迭代：\n\n`,
    );
  });

  test("shows export error message when writing docx export fails", async ({
    page,
  }) => {
    const sessionId = "writing-deliverable-error";
    const filePath = "outputs/钢材周报.md";
    const projectId = "proj-bisheng";

    await seedDeliverableSession(page, {
      sessionId,
      route: `/writing/${sessionId}`,
      projectId,
      filePath,
      buttonLabel: "生成 DOCX",
    });

    await page.route("**/api/writing/export-docx", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "pandoc_not_installed",
          message: "未检测到 Pandoc，请先安装：brew install pandoc",
        }),
      });
    });

    await page.getByRole("button", { name: "生成 DOCX" }).click();
    await expect(
      page.getByText("未检测到 Pandoc，请先安装：brew install pandoc"),
    ).toBeVisible();
  });
});
