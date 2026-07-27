import assert from "node:assert/strict";
import test from "node:test";

import type {
  RunEvent,
  RunRecord,
  SkillFailedEvent,
  SkillReadyEvent,
  SkillSelectedEvent,
} from "../packages/contracts/src/index.js";
import type { ChatMessage } from "../web/src/lib/chat.js";
import {
  initAssistantPartsState,
  reduceRunStarted,
  reduceSkillLifecycle,
  reduceStreamCancelled,
} from "../web/src/lib/chat-parts-reducer.js";
import { applyRunEventsToMessage } from "../web/src/lib/chat-run-events.js";

const occurredAt = "2026-07-24T00:00:00.000Z";
const contentHash = `sha256:${"a".repeat(64)}`;
const bundleHash = `sha256:${"b".repeat(64)}`;

function selected(
  overrides: Partial<SkillSelectedEvent> = {},
): SkillSelectedEvent {
  return {
    skillEventVersion: 1,
    type: "skill.selected",
    eventId: "event-selected",
    decisionId: "decision-selected",
    runId: "run-selected",
    sessionId: "session-selected",
    occurredAt,
    streamSeq: 4,
    primarySkillSlug: "skill-wr-industry",
    requiredSkillSlugs: [],
    selectionSource: "explicit",
    reasonCode: "explicit_structured",
    ...overrides,
  };
}

function ready(overrides: Partial<SkillReadyEvent> = {}): SkillReadyEvent {
  return {
    skillEventVersion: 1,
    type: "skill.ready",
    eventId: "event-ready",
    decisionId: "decision-selected",
    runId: "run-selected",
    sessionId: "session-selected",
    occurredAt,
    streamSeq: 5,
    items: [
      {
        slug: "skill-wr-industry",
        version: "1.0.0",
        contentHash,
        cacheStatus: "miss",
      },
    ],
    bundleHash,
    bundleCacheStatus: "miss",
    agentKitPath: null,
    ...overrides,
  };
}

function failed(overrides: Partial<SkillFailedEvent> = {}): SkillFailedEvent {
  return {
    skillEventVersion: 1,
    type: "skill.failed",
    eventId: "event-failed",
    decisionId: "decision-selected",
    runId: "run-selected",
    sessionId: "session-selected",
    occurredAt,
    streamSeq: 5,
    failedSkillSlug: "skill-wr-industry",
    failureStage: "body",
    loadedItems: [],
    failureCode: "body_missing",
    failureMessage: "Skill body is missing.",
    fallbackMode: "blocked",
    ...overrides,
  };
}

function assistantMessage(runId = "run-selected"): ChatMessage {
  return {
    id: "assistant-message",
    role: "assistant",
    content: "",
    status: "streaming",
    runId,
  };
}

function skillParts(state: ReturnType<typeof initAssistantPartsState>) {
  return state.parts.filter((part) => part.kind === "skill");
}

test("V2 run.started and a none Decision do not synthesize Skill UI", () => {
  const started = reduceRunStarted(initAssistantPartsState(), {
    runId: "run-none",
    orchestrationMode: "companion-select-v2",
    processSkill: "skill-qa",
    catalogSlugs: ["skill-wr-industry"],
    injectedSkills: [],
  });
  assert.equal(skillParts(started).length, 0);
  assert.equal(
    started.parts.some(
      (part) => part.kind === "status" && part.label.startsWith("基座 ·"),
    ),
    false,
  );

  const record = {
    runId: "run-none",
    tenantId: "local",
    projectId: "project-none",
    workspaceId: "workspace-none",
    sessionId: "session-none",
    turnId: "turn-none",
    agentId: "codex",
    agentModel: "default",
    status: "completed",
    queuePolicy: "interrupt",
    createdAt: occurredAt,
    skillDecision: {
      decisionVersion: 1,
      decisionId: "decision-none",
      sessionId: "session-none",
      runId: "run-none",
      decisionOutcome: "none",
      requestedSkillSlug: null,
      primarySkillSlug: null,
      requiredSkillSlugs: [],
      selectionSource: "none",
      reasonCode: "no_match",
      reasonText: "No skill matched.",
      selectorVersion: "0.1.7-v1",
      decidedAt: occurredAt,
    },
  } satisfies RunRecord;
  const events = [
    {
      type: "run.started",
      runId: "run-none",
      cwd: "/tmp/workspace",
      agentId: "codex",
      orchestrationMode: "companion-select-v2",
      streamSeq: 1,
    },
    { type: "run.finished", runId: "run-none", streamSeq: 2 },
  ] satisfies RunEvent[];
  const replayed = applyRunEventsToMessage(
    assistantMessage("run-none"),
    events,
    record,
  );
  assert.equal(replayed.parts?.some((part) => part.kind === "skill"), false);
});

test("selected -> ready updates one stable Skill row and is event-idempotent", () => {
  const initial = initAssistantPartsState();
  const selecting = reduceSkillLifecycle(initial, selected());
  const selectedPart = skillParts(selecting)[0];
  assert.equal(selectedPart?.lifecycleStatus, "selected");
  assert.equal(selectedPart?.streaming, true);
  assert.equal(selectedPart?.streamSeq, 4);

  const completed = reduceSkillLifecycle(selecting, ready());
  const readyPart = skillParts(completed)[0];
  assert.equal(skillParts(completed).length, 1);
  assert.equal(readyPart?.id, selectedPart?.id);
  assert.equal(readyPart?.eventId, "event-ready");
  assert.equal(readyPart?.lifecycleStatus, "ready");
  assert.equal(readyPart?.bundleCacheStatus, "miss");
  assert.equal(readyPart?.streaming, false);
  assert.equal(readyPart?.streamSeq, 4);

  assert.strictEqual(reduceSkillLifecycle(completed, ready()), completed);
  assert.strictEqual(
    reduceSkillLifecycle(completed, selected({ eventId: "late-selected" })),
    completed,
  );
});

test("selected -> failed exposes the real failure and never becomes ready", () => {
  const selecting = reduceSkillLifecycle(
    initAssistantPartsState(),
    selected(),
  );
  const completed = reduceSkillLifecycle(selecting, failed());
  const part = skillParts(completed)[0];
  assert.equal(part?.lifecycleStatus, "failed");
  assert.equal(part?.failureCode, "body_missing");
  assert.equal(part?.failureMessage, "Skill body is missing.");
  assert.equal(part?.streaming, false);

  assert.strictEqual(
    reduceSkillLifecycle(completed, ready({ eventId: "late-ready" })),
    completed,
  );
});

test("AC-21 cancelling after selected clears the loading state", () => {
  const selecting = reduceSkillLifecycle(
    initAssistantPartsState(),
    selected(),
  );
  const cancelled = reduceStreamCancelled(selecting);
  const part = skillParts(cancelled)[0];
  assert.equal(part?.lifecycleStatus, "cancelled");
  assert.equal(part?.streaming, false);
  assert.equal(typeof part?.completedAt, "number");
});

test("AC-22 history replay preserves lifecycle event identity without duplicates", () => {
  const events = [
    {
      type: "run.started",
      runId: "run-selected",
      cwd: "/tmp/workspace",
      agentId: "codex",
      orchestrationMode: "companion-select-v2",
      streamSeq: 1,
    },
    selected(),
    ready(),
    { type: "run.finished", runId: "run-selected", streamSeq: 6 },
  ] satisfies RunEvent[];
  const replayed = applyRunEventsToMessage(assistantMessage(), events);
  const parts = replayed.parts?.filter((part) => part.kind === "skill") ?? [];
  assert.equal(parts.length, 1);
  assert.equal(parts[0]?.decisionId, "decision-selected");
  assert.equal(parts[0]?.eventId, "event-ready");
  assert.equal(parts[0]?.lifecycleStatus, "ready");
  assert.equal(parts[0]?.streamSeq, 4);
});
