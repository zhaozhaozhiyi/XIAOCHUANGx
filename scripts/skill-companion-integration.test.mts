import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import type { RunEvent, RunRecord } from "../packages/contracts/src/index.js";
import type { CreateRunRequest } from "../companion/src/types.js";

const dataDir = await mkdtemp(join(tmpdir(), "jlc-skill-companion-"));
process.env.COMPANION_DATA_DIR = dataDir;
process.env.COMPANION_RUN_MODE = "simulate";
process.env.SKILL_ORCHESTRATION_V2_ENABLED = "true";

const { cancelRun, executeRunLifecycle, isRunActive } = await import(
  "../companion/src/runs/manager.js"
);
const { createRuntimeStoreWriter } = await import(
  "../companion/src/runs/runtime-store-writer.js"
);
const { loadRunEvents, loadRunRecord } = await import(
  "../companion/src/runs/store.js"
);
const {
  clearSelectedSkillBundleCache,
  getAgentKitMetrics,
  getSkillLoaderMetrics,
  resetAgentKitMetrics,
  resetSkillLoaderMetrics,
} = await import("../packages/runtime-core/dist/index.js");

after(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

function request(
  input: {
    agentId?: "codex" | "claude" | "hermes";
    sessionId?: string;
    userText?: string;
    requestedSkillSlug?: string;
  } = {},
): CreateRunRequest {
  const agentId = input.agentId ?? "codex";
  const sessionId = input.sessionId ?? `session-${agentId}`;
  return {
    sessionId,
    projectId: "none",
    workspaceProjectId: "__lazy_default__",
    lazyDefaultWorkspace: {
      moduleId: "chat",
      taskId: sessionId,
      taskTitle: "Skill orchestration integration test",
    },
    moduleId: "chat",
    binding: { moduleId: "chat", mode: "auto" },
    agentId,
    agentModel: "default",
    messages: [
      {
        id: `message-${sessionId}`,
        role: "user",
        content: input.userText ?? "你好",
      },
    ],
    useClientHistory: true,
    ...(input.requestedSkillSlug
      ? { requestedSkillSlug: input.requestedSkillSlug }
      : {}),
  };
}

type ObservedEvent = { event: string; data: Record<string, unknown> };

async function execute(
  req: CreateRunRequest,
  runId: string,
  onSend?: (event: string, data: Record<string, unknown>) => void,
): Promise<{ record: RunRecord; events: RunEvent[]; observed: ObservedEvent[] }> {
  const observed: ObservedEvent[] = [];
  const baseWriter = {
    send(event: string, value: unknown) {
      const data =
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : {};
      observed.push({ event, data });
      onSend?.(event, data);
    },
    end() {},
  };
  const writer = createRuntimeStoreWriter(req, runId, baseWriter);
  await executeRunLifecycle(req, writer, runId);
  const record = await loadRunRecord(runId);
  assert.ok(record, `RunRecord ${runId} should exist`);
  return {
    record,
    events: await loadRunEvents(runId),
    observed,
  };
}

function skillEvents(events: RunEvent[]): RunEvent[] {
  return events.filter((event) => event.type.startsWith("skill."));
}

test("none Decision is persisted and does not invoke Loader or Agent Kit", async () => {
  clearSelectedSkillBundleCache();
  resetSkillLoaderMetrics();
  resetAgentKitMetrics();
  const result = await execute(
    request({ sessionId: "session-none", userText: "你好" }),
    "run-none",
  );

  assert.equal(result.record.skillDecision?.decisionOutcome, "none");
  assert.deepEqual(skillEvents(result.events), []);
  assert.equal(getSkillLoaderMetrics().skillBodyReadCount, 0);
  assert.equal(getAgentKitMetrics().agentKitCreateCount, 0);
  const started = result.events.find((event) => event.type === "run.started");
  assert.equal(
    started?.type === "run.started" && started.orchestrationMode,
    "companion-select-v2",
  );
  assert.deepEqual(
    started?.type === "run.started" ? started.injectedSkills : undefined,
    [],
  );
});

test("selected Decision is on disk before skill.selected and ends in one ready", async () => {
  clearSelectedSkillBundleCache();
  resetSkillLoaderMetrics();
  resetAgentKitMetrics();
  let decisionAtSelection: RunRecord["skillDecision"];
  const runId = "run-selected";
  const result = await execute(
    request({
      sessionId: "session-selected",
      requestedSkillSlug: "skill-wr-industry",
      userText: "制作行业研究",
    }),
    runId,
    (event) => {
      if (event !== "skill.selected") return;
      const raw = readFileSync(
        join(dataDir, "runs", "records", `${runId}.json`),
        "utf8",
      );
      decisionAtSelection = JSON.parse(raw).skillDecision;
    },
  );

  assert.equal(decisionAtSelection?.decisionOutcome, "selected");
  assert.equal(
    decisionAtSelection?.decisionId,
    result.record.skillDecision?.decisionId,
  );
  assert.deepEqual(
    skillEvents(result.events).map((event) => event.type),
    ["skill.selected", "skill.ready"],
  );
  const selectedEvent = result.events.find(
    (event) => event.type === "skill.selected",
  );
  const readyEvent = result.events.find((event) => event.type === "skill.ready");
  assert.equal(selectedEvent?.decisionId, result.record.skillDecision?.decisionId);
  assert.equal(readyEvent?.decisionId, result.record.skillDecision?.decisionId);
  assert.equal(
    readyEvent?.type === "skill.ready" && readyEvent.items[0]?.slug,
    "skill-wr-industry",
  );
  assert.equal(
    skillEvents(result.events).some((event) => event.type === "skill.failed"),
    false,
  );
  assert.equal(getSkillLoaderMetrics().skillBodyReadCount, 1);
  assert.equal(getAgentKitMetrics().agentKitCreateCount, 0);
});

test("rejected explicit request emits only failed and never invokes Loader", async () => {
  clearSelectedSkillBundleCache();
  resetSkillLoaderMetrics();
  resetAgentKitMetrics();
  const result = await execute(
    request({
      sessionId: "session-rejected",
      requestedSkillSlug: "skill-qa",
      userText: "使用这个 Skill",
    }),
    "run-rejected",
  );

  assert.equal(result.record.skillDecision?.decisionOutcome, "rejected");
  assert.deepEqual(
    skillEvents(result.events).map((event) => event.type),
    ["skill.failed"],
    JSON.stringify({
      persisted: result.events.map((event) => event.type),
      observed: result.observed.map(({ event, data }) => ({ event, data })),
    }),
  );
  const failure = result.events.find((event) => event.type === "skill.failed");
  assert.equal(
    failure?.type === "skill.failed" && failure.failureStage,
    "selection",
  );
  assert.equal(
    failure?.type === "skill.failed" && failure.failureCode,
    "skill_disabled",
  );
  assert.equal(getSkillLoaderMetrics().skillBodyReadCount, 0);
  assert.equal(getAgentKitMetrics().agentKitCreateCount, 0);
});

test("unavailable required capability rejects an explicit Skill before loading", async () => {
  clearSelectedSkillBundleCache();
  resetSkillLoaderMetrics();
  const result = await execute(
    request({
      sessionId: "session-capability-unavailable",
      requestedSkillSlug: "skill-kb-qa",
      userText: "查询知识库",
    }),
    "run-capability-unavailable",
  );

  assert.deepEqual(
    [
      result.record.skillDecision?.decisionOutcome,
      result.record.skillDecision?.reasonCode,
    ],
    ["rejected", "capability_unavailable"],
  );
  assert.deepEqual(
    skillEvents(result.events).map((event) => event.type),
    ["skill.failed"],
  );
  assert.equal(getSkillLoaderMetrics().skillBodyReadCount, 0);
});

test("AC-21 cancellation after selected emits neither ready nor failed", async () => {
  clearSelectedSkillBundleCache();
  const runId = "run-cancel-after-selected";
  const result = await execute(
    request({
      sessionId: "session-cancel-after-selected",
      requestedSkillSlug: "skill-wr-industry",
      userText: "制作行业研究",
    }),
    runId,
    (event) => {
      if (event === "skill.selected") {
        assert.equal(cancelRun(runId), true);
      }
    },
  );

  assert.deepEqual(
    skillEvents(result.events).map((event) => event.type),
    ["skill.selected"],
  );
  assert.equal(
    result.events.some((event) => event.type === "run.cancelled"),
    true,
  );
  assert.equal(result.record.status, "cancelled");
  assert.equal(isRunActive(runId), false);
});

test("Codex, Claude and Hermes consume the same Decision and bundle", async () => {
  clearSelectedSkillBundleCache();
  const results = [];
  for (const agentId of ["codex", "claude", "hermes"] as const) {
    results.push(
      await execute(
        request({
          agentId,
          sessionId: `session-agent-${agentId}`,
          requestedSkillSlug: "skill-wr-industry",
          userText: "制作行业研究",
        }),
        `run-agent-${agentId}`,
      ),
    );
  }

  const decisions = results.map((result) => ({
    outcome: result.record.skillDecision?.decisionOutcome,
    primary: result.record.skillDecision?.primarySkillSlug,
    required: result.record.skillDecision?.requiredSkillSlugs,
    source: result.record.skillDecision?.selectionSource,
    reason: result.record.skillDecision?.reasonCode,
  }));
  assert.deepEqual(decisions[1], decisions[0]);
  assert.deepEqual(decisions[2], decisions[0]);

  const bundles = results.map((result) => {
    const started = result.events.find((event) => event.type === "run.started");
    const ready = result.events.find((event) => event.type === "skill.ready");
    return {
      eventTypes: skillEvents(result.events).map((event) => event.type),
      bundleHash:
        started?.type === "run.started" ? started.bundleHash : undefined,
      items:
        ready?.type === "skill.ready"
          ? ready.items.map((item) => ({
              slug: item.slug,
              version: item.version,
              contentHash: item.contentHash,
            }))
          : [],
    };
  });
  assert.deepEqual(bundles[1], bundles[0]);
  assert.deepEqual(bundles[2], bundles[0]);
});
