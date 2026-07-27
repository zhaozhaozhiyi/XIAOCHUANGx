import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type {
  SkillFailedEvent,
  SkillReadyEvent,
  SkillSelectedEvent,
} from "@jlc/contracts";
import type { ChatMessage } from "../../src/lib/chat";
import {
  initAssistantPartsState,
  reduceSkillLifecycle,
  reduceStreamCancelled,
} from "../../src/lib/chat-parts-reducer";
import { seedAuthenticatedSession } from "./helpers";

const occurredAt = "2026-07-24T00:00:00.000Z";
const contentHash = `sha256:${"a".repeat(64)}`;
const bundleHash = `sha256:${"b".repeat(64)}`;
const evidenceDir = resolve(
  process.cwd(),
  "..",
  "output",
  "skill-orchestration-0.1.7",
);

function selected(decisionId: string, eventId: string): SkillSelectedEvent {
  return {
    skillEventVersion: 1,
    type: "skill.selected",
    eventId,
    decisionId,
    runId: `run-${decisionId}`,
    sessionId: "skill-lifecycle-e2e",
    occurredAt,
    primarySkillSlug: "skill-wr-industry",
    requiredSkillSlugs: [],
    selectionSource: "explicit",
    reasonCode: "explicit_structured",
  };
}

function ready(decisionId: string): SkillReadyEvent {
  return {
    skillEventVersion: 1,
    type: "skill.ready",
    eventId: `event-ready-${decisionId}`,
    decisionId,
    runId: `run-${decisionId}`,
    sessionId: "skill-lifecycle-e2e",
    occurredAt,
    items: [
      {
        slug: "skill-wr-industry",
        version: "1.0",
        contentHash,
        cacheStatus: "miss",
      },
    ],
    bundleHash,
    bundleCacheStatus: "miss",
    agentKitPath: null,
  };
}

function failed(decisionId: string): SkillFailedEvent {
  return {
    skillEventVersion: 1,
    type: "skill.failed",
    eventId: `event-failed-${decisionId}`,
    decisionId,
    runId: `run-${decisionId}`,
    sessionId: "skill-lifecycle-e2e",
    occurredAt,
    failedSkillSlug: "skill-wr-industry",
    failureStage: "body",
    loadedItems: [],
    failureCode: "body_missing",
    failureMessage: "Skill 正文缺失，未生成可用状态。",
    fallbackMode: "blocked",
  };
}

function assistant(
  id: string,
  parts: ChatMessage["parts"],
  status: ChatMessage["status"] = "complete",
): ChatMessage {
  return {
    id,
    role: "assistant",
    content: "",
    status,
    parts,
    activityCollapse: "user_expanded",
  };
}

function fixtureMessages(): ChatMessage[] {
  const selectedState = reduceSkillLifecycle(
    initAssistantPartsState(),
    selected("selected", "event-selected-selected"),
  );
  const readyState = reduceSkillLifecycle(
    reduceSkillLifecycle(
      initAssistantPartsState(),
      selected("ready", "event-selected-ready"),
    ),
    ready("ready"),
  );
  const failedState = reduceSkillLifecycle(
    reduceSkillLifecycle(
      initAssistantPartsState(),
      selected("failed", "event-selected-failed"),
    ),
    failed("failed"),
  );
  const cancelledState = reduceStreamCancelled(
    reduceSkillLifecycle(
      initAssistantPartsState(),
      selected("cancelled", "event-selected-cancelled"),
    ),
  );
  return [
    {
      id: "user-none",
      role: "user",
      content: "普通对话不选择 Skill",
      status: "complete",
    },
    assistant("assistant-none", [
      {
        id: "summary-none",
        kind: "summary",
        zone: "summary",
        markdown: "普通回答保持基础能力。",
      },
    ]),
    {
      id: "user-selected",
      role: "user",
      content: "显式选择后的准备状态",
      status: "complete",
    },
    assistant("assistant-selected", selectedState.parts, "streaming"),
    {
      id: "user-ready",
      role: "user",
      content: "Skill 加载成功",
      status: "complete",
    },
    assistant("assistant-ready", readyState.parts),
    {
      id: "user-failed",
      role: "user",
      content: "Skill 加载失败",
      status: "complete",
    },
    assistant("assistant-failed", failedState.parts, "error"),
    {
      id: "user-cancelled",
      role: "user",
      content: "Skill 准备中取消",
      status: "complete",
    },
    assistant("assistant-cancelled", cancelledState.parts, "cancelled"),
  ];
}

async function seed(page: Page, sessionId: string) {
  await seedAuthenticatedSession(page);
  const messages = fixtureMessages();
  await page.addInitScript(
    ([id, value]) => {
      window.localStorage.setItem(`jlc-chat-messages-${id}`, value);
      window.localStorage.setItem(`jlc-chat-started-${id}`, "1");
    },
    [sessionId, JSON.stringify(messages)],
  );
}

async function openTechnicalDetails(page: Page) {
  const buttons = page.getByRole("button", { name: "技术详情" });
  const count = await buttons.count();
  for (let index = 0; index < count; index += 1) {
    await buttons.nth(index).click();
  }
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    skillRows: [...document.querySelectorAll<HTMLElement>(".chat-part-row")].map(
      (row) => ({ clientWidth: row.clientWidth, scrollWidth: row.scrollWidth }),
    ),
  }));
  expect(overflow.document).toBeLessThanOrEqual(overflow.viewport + 1);
  expect(
    overflow.skillRows.every(
      ({ clientWidth, scrollWidth }) => scrollWidth <= clientWidth + 1,
    ),
  ).toBe(true);
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
] as const) {
  test(`renders truthful Skill lifecycle without overflow on ${viewport.name}`, async ({
    page,
  }) => {
    const sessionId = `skill-lifecycle-${viewport.name}`;
    await page.setViewportSize(viewport);
    await seed(page, sessionId);
    await page.goto(`/chat/${sessionId}`);
    await expect(page.getByText("普通回答保持基础能力。")).toBeVisible();
    await openTechnicalDetails(page);

    await expect(page.getByText("正在准备", { exact: true })).toHaveCount(1);
    await expect(page.getByText("已就绪", { exact: true })).toHaveCount(1);
    await expect(page.getByText("失败", { exact: true })).toHaveCount(1);
    await expect(page.getByText("已取消", { exact: true })).toHaveCount(1);
    await expect(page.getByText("Skill 正文缺失，未生成可用状态。")).toBeVisible();
    await expect(page.locator(".chat-part-row")).toHaveCount(4);
    await assertNoHorizontalOverflow(page);

    mkdirSync(evidenceDir, { recursive: true });
    await page.screenshot({
      path: resolve(evidenceDir, `skill-lifecycle-${viewport.name}.png`),
      fullPage: true,
    });
  });
}
