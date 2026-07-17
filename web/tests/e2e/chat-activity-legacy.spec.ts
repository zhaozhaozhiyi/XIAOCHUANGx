import { expect, test } from "@playwright/test";
import { seedAuthenticatedSession } from "./helpers";

test.describe("chat activity legacy rollback", () => {
  test.skip(
    !["0", "false", "off", "disabled"].includes(
      (process.env.CHAT_ACTIVITY_V2_ENABLED ?? "").toLowerCase(),
    ),
    "Runs only when the 0.1.6 activity renderer is disabled",
  );

  test("renders the 0.1.5 interleaved timeline from unchanged message data", async ({
    page,
  }) => {
    const sessionId = `legacy-activity-${Date.now()}`;
    await seedAuthenticatedSession(page);
    await page.addInitScript(([seedSessionId]) => {
      window.localStorage.setItem(
        `jlc-chat-messages-${seedSessionId}`,
        JSON.stringify([
          {
            id: "legacy-user",
            role: "user",
            content: "检查旧渲染路径",
            status: "complete",
          },
          {
            id: "legacy-assistant",
            role: "assistant",
            content: "旧路径最终回答",
            status: "complete",
            parts: [
              {
                id: "legacy-read",
                zone: "activity",
                kind: "file_read",
                path: "src/legacy.ts",
                streamSeq: 1,
              },
              {
                id: "legacy-answer",
                zone: "summary",
                kind: "summary",
                markdown: "旧路径最终回答",
                streamSeq: 2,
              },
            ],
          },
        ]),
      );
      window.localStorage.setItem(`jlc-chat-started-${seedSessionId}`, "1");
    }, [sessionId]);

    await page.goto(`/chat/${sessionId}`);
    await expect(page.locator('.bubble-assistant[data-renderer="legacy"]')).toBeVisible();
    await expect(page.getByText("legacy.ts")).toBeVisible();
    await expect(page.getByText("旧路径最终回答")).toBeVisible();
    await expect(page.getByTestId("activity-section")).toHaveCount(0);
  });
});
