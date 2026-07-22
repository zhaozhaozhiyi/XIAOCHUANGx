import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  appendFinalSegment,
  createFinalSegmentAccumulator,
} from "../companion/src/runs/assistant-segments";
import { defaultOnEvent } from "../packages/runtime-core/src/adapters/shared";
import { createClaudeJsonlParser } from "../packages/runtime-core/src/parsers/claude-jsonl";
import { createCodexJsonParser } from "../packages/runtime-core/src/parsers/codex-json";
import { createHermesPlainParser } from "../packages/runtime-core/src/parsers/hermes-plain";
import { runHermesGateway } from "../packages/runtime-core/src/run-hermes-gateway";
import { buildLaunchSpec } from "../packages/runtime-core/src/agents/build-args";
import type { AgentStreamEvent } from "../packages/runtime-core/src/types";
import type { RunEvent, RunRecord } from "../packages/contracts/src/runtime";
import { parseMessages } from "../companion/src/routes/sessions";
import type { ChatMessage } from "../web/src/lib/chat";
import type { CanonicalTurnOutput, ChatPart } from "../web/src/lib/chat-parts";
import {
  buildActivityViewModel,
  buildActivityOccurrences,
  resolveActivityProcessExpanded,
} from "../web/src/lib/chat-activity-view-model";
import { sanitizeActivityDetail } from "../web/src/lib/activity-detail-sanitize";
import {
  applyPartsStateToMessage,
  initAssistantPartsState,
  reduceAssistantSegment,
  reduceStreamFinished,
  reduceStreamError,
  reduceTextDelta,
  reduceToolProgress,
} from "../web/src/lib/chat-parts-reducer";
import { buildTurnViewModel } from "../web/src/lib/chat-turn-view-model";
import { resolveTurnDisplayState } from "../web/src/lib/chat-turn-display-state";
import { applyRunEventsToMessage } from "../web/src/lib/chat-run-events";
import { selectSimulationTopicAnalysisActivity } from "../web/src/lib/simulation-topic-analysis-activity";

function message(
  parts: ChatPart[] = [],
  status: ChatMessage["status"] = "complete",
  patch: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: patch.id ?? "assistant-test",
    role: "assistant",
    content: patch.content ?? "",
    status,
    parts: parts.map((part, index) => ({ ...part, streamSeq: part.streamSeq ?? index })),
    ...patch,
  };
}

function canonical(
  markdown: string,
  options?: {
    status?: CanonicalTurnOutput["outcome"]["status"];
    nextAction?: CanonicalTurnOutput["nextAction"];
    artifacts?: CanonicalTurnOutput["artifacts"];
  },
): CanonicalTurnOutput {
  return {
    protocolVersion: 1,
    sessionId: "session-test",
    turnId: "assistant-test",
    runId: "run-test",
    provider: { agentId: "codex", providerId: "codex" },
    outcome: { status: options?.status ?? "success", durationMs: 42_000 },
    finalAnswer: { markdown },
    nextAction: options?.nextAction,
    artifacts: options?.artifacts,
  };
}

function readPart(id: string, path: string, streamSeq?: number): ChatPart {
  return { id, zone: "activity", kind: "file_read", path, streamSeq };
}

function editPart(id: string, path: string, streamSeq?: number): ChatPart {
  return { id, zone: "activity", kind: "file_edit", path, streamSeq };
}

function statusPart(id: string, label: string, streamSeq?: number): ChatPart {
  return { id, zone: "activity", kind: "status", label, streamSeq };
}

const tests: Array<[string, () => void | Promise<void>]> = [
  ["F01 content-only history", () => {
    const model = buildTurnViewModel(message([], "complete", { content: "旧回答" }));
    assert.equal(model.activity.hasActivity, false);
    assert.equal(model.resultItems[0]?.type, "answer");
  }],
  ["F02 canonical answer renders once", () => {
    const model = buildTurnViewModel(
      message(
        [readPart("read", "a.md"), { id: "summary", zone: "summary", kind: "summary", markdown: "旧正文" }],
        "complete",
        { canonicalOutput: canonical("权威正文") },
      ),
    );
    assert.equal(model.resultItems.filter((item) => item.type === "answer").length, 1);
    assert.equal(model.resultItems.find((item) => item.type === "answer")?.type === "answer" && model.resultItems.find((item) => item.type === "answer")?.markdown, "权威正文");
  }],
  ["F03 multiple text segments merge", () => {
    const model = buildTurnViewModel(message([
      { id: "t1", zone: "summary", kind: "text", markdown: "第一段" },
      { id: "t2", zone: "summary", kind: "text", markdown: "第二段" },
    ], "streaming"));
    const answer = model.resultItems.find((item) => item.type === "answer");
    assert.equal(answer?.type === "answer" && answer.markdown, "第一段\n\n第二段");
  }],
  ["F04 repeated streamed text dedupes", () => {
    const model = buildTurnViewModel(message([
      { id: "t1", zone: "summary", kind: "text", markdown: "相同正文" },
      { id: "t2", zone: "summary", kind: "summary", markdown: "相同正文" },
    ]));
    const answer = model.resultItems.find((item) => item.type === "answer");
    assert.equal(answer?.type === "answer" && answer.markdown, "相同正文");
  }],
  ["F05 repeated reads aggregate inside episode", () => {
    const parts = [statusPart("s", "读取实现"), ...Array.from({ length: 6 }, (_, index) => readPart(`r${index}`, "src/a.ts"))];
    const model = buildActivityViewModel(message(parts));
    assert.equal(model.episodes[0]?.occurrences[0]?.count, 6);
    assert.match(model.summaryLabel, /读取 1 个文件/);
  }],
  ["F06 line ranges remain traceable", () => {
    const parts: ChatPart[] = [
      { ...readPart("r1", "src/a.ts"), kind: "file_read", lineRange: { start: 1, end: 5 } },
      { ...readPart("r2", "src/a.ts"), kind: "file_read", lineRange: { start: 8, end: 12 } },
    ];
    const occurrence = buildActivityViewModel(message(parts)).episodes[0]?.occurrences[0];
    assert.equal(occurrence?.count, 2);
    assert.equal(occurrence?.sourcePartIds.length, 2);
  }],
  ["F07 repeated edits aggregate inside episode", () => {
    const parts = [statusPart("s", "修改实现"), editPart("e1", "a.ts"), editPart("e2", "a.ts"), editPart("e3", "a.ts")];
    const model = buildActivityViewModel(message(parts));
    assert.equal(model.episodes[0]?.occurrences[0]?.count, 3);
    assert.match(model.summaryLabel, /编辑 1 个文件/);
  }],
  ["F08 bash command and tool pair", () => {
    const parts: ChatPart[] = [
      { id: "c", zone: "activity", kind: "command", command: "pnpm test", streamSeq: 1 },
      { id: "t", zone: "activity", kind: "tool", tool: "Bash", status: "success", input: { command: "pnpm test" }, streamSeq: 2 },
    ];
    const occurrences = buildActivityOccurrences(parts);
    assert.equal(occurrences.length, 1);
    assert.deepEqual(new Set(occurrences[0]?.sourcePartIds), new Set(["c", "t"]));
  }],
  ["F09 real repeated commands keep count", () => {
    const parts: ChatPart[] = Array.from({ length: 3 }, (_, index) => ({
      id: `c${index}`,
      zone: "activity",
      kind: "command",
      command: "pnpm test",
      streamSeq: index,
    }));
    const model = buildActivityViewModel(message(parts));
    assert.equal(model.episodes[0]?.occurrences[0]?.count, 3);
    assert.match(model.summaryLabel, /运行 3 条命令/);
  }],
  ["F10 unknown tool is other", () => {
    const model = buildActivityViewModel(message([
      { id: "u", zone: "activity", kind: "tool", tool: "future_tool", status: "success" },
    ]));
    assert.equal(model.occurrences[0]?.family, "other");
  }],
  ["F11 reasoning stays in the business timeline", () => {
    const model = buildActivityViewModel(message([
      { id: "reason", zone: "activity", kind: "reasoning", markdown: "private analysis" },
    ]));
    assert.equal(model.timelineNodes[0]?.type, "reasoning");
    assert.equal(model.debugParts.some((part) => part.kind === "reasoning"), false);
    assert.equal(model.technicalParts.some((part) => part.kind === "reasoning"), false);
    assert.equal(model.episodes.length, 0);
  }],
  ["F12 ask-user canonical state", () => {
    const msg = message([], "complete", {
      canonicalOutput: canonical("", { nextAction: { type: "ask_user", message: "请选择目录" } }),
    });
    assert.equal(resolveTurnDisplayState(msg), "waiting_user");
  }],
  ["F13 error keeps partial result", () => {
    const model = buildTurnViewModel(message([
      { id: "text", zone: "summary", kind: "text", markdown: "部分正文" },
      { id: "error", zone: "activity", kind: "error", message: "命令失败" },
    ], "error"));
    assert.equal(model.outcome?.kind, "error");
    assert.equal(model.outcome?.partial, true);
  }],
  ["F14 cancelled keeps artifacts", () => {
    const model = buildTurnViewModel(message([
      { id: "artifact", zone: "summary", kind: "artifact", path: "out/a.md" },
    ], "cancelled"));
    assert.equal(model.deliverableParts.length, 1);
    assert.equal(model.outcome?.kind, "cancelled");
  }],
  ["F15 artifact and deliverables dedupe", () => {
    const model = buildTurnViewModel(message([
      { id: "a", zone: "summary", kind: "artifact", path: "out/a.md" },
      { id: "d", zone: "summary", kind: "deliverables", items: [{ path: "out/a.md" }] },
    ]));
    assert.equal(model.deliverableParts.length, 1);
    assert.equal(model.deliverableParts[0]?.kind, "deliverables");
  }],
  ["F16 requirements remain interactive checkpoint", () => {
    const model = buildTurnViewModel(message([
      { id: "req", zone: "summary", kind: "writing_requirements", title: "写作要求", questions: [] },
    ]));
    assert.equal(model.state, "waiting_user");
    assert.equal(model.resultItems.length, 0);
    assert.equal(model.activity.timelineNodes[0]?.type, "checkpoint");
  }],
  ["F17 1000 activity parts remain linear", () => {
    const parts = Array.from({ length: 1000 }, (_, index) => readPart(`r${index}`, `src/${index % 25}.ts`, index));
    const started = performance.now();
    const model = buildActivityViewModel(message(parts));
    assert.equal(model.rawPartCount, 1000);
    assert.ok(performance.now() - started < 1_000);
  }],
  ["F18 missing collapse does not affect model", () => {
    assert.equal(buildTurnViewModel(message([readPart("r", "a.ts")])).activity.hasActivity, true);
  }],
  ["F19 user-expanded survives parts patch", () => {
    const msg = message([], "streaming", { activityCollapse: "user_expanded" });
    const next = applyPartsStateToMessage(msg, { ...initAssistantPartsState(), activityCollapse: "collapsed" });
    assert.equal(next.activityCollapse, "user_expanded");
  }],
  ["F20 user-collapsed survives parts patch", () => {
    const msg = message([], "streaming", { activityCollapse: "user_collapsed" });
    const next = applyPartsStateToMessage(msg, { ...initAssistantPartsState(), activityCollapse: "expanded" });
    assert.equal(next.activityCollapse, "user_collapsed");
  }],
  ["F21 SSE-style patch preserves preference", () => {
    const msg = message([readPart("r", "a.ts")], "streaming", { activityCollapse: "user_expanded" });
    const state = { ...initAssistantPartsState(), parts: [readPart("r", "a.ts"), editPart("e", "a.ts")] };
    assert.equal(applyPartsStateToMessage(msg, state).activityCollapse, "user_expanded");
  }],
  ["F22 finish preserves preference", () => {
    const msg = message([], "streaming", { activityCollapse: "user_expanded" });
    const finished = reduceStreamFinished(initAssistantPartsState());
    assert.equal(applyPartsStateToMessage(msg, finished).activityCollapse, "user_expanded");
  }],
  ["F23 replay-style replacement preserves preference", () => {
    const msg = message([], "complete", { activityCollapse: "user_collapsed" });
    const replay = { ...initAssistantPartsState(), parts: [readPart("r", "a.ts")], activityCollapse: "expanded" as const };
    assert.equal(applyPartsStateToMessage(msg, replay).activityCollapse, "user_collapsed");
  }],
  ["F24 completed empty outcome", () => {
    const model = buildTurnViewModel(message());
    assert.equal(model.state, "complete_empty");
    assert.equal(model.outcome?.kind, "complete_empty");
  }],
  ["F25 provisional reconciles to canonical", () => {
    const parts: ChatPart[] = [{ id: "t", zone: "summary", kind: "text", markdown: "临时正文" }];
    const running = buildTurnViewModel(message(parts, "streaming", { canonicalOutput: canonical("最终正文") }));
    const complete = buildTurnViewModel(message(parts, "complete", { canonicalOutput: canonical("最终正文") }));
    assert.equal(running.resultItems.find((item) => item.type === "answer")?.type === "answer" && running.resultItems.find((item) => item.type === "answer")?.markdown, "临时正文");
    assert.equal(complete.resultItems.find((item) => item.type === "answer")?.type === "answer" && complete.resultItems.find((item) => item.type === "answer")?.markdown, "最终正文");
  }],
  ["F26 image path uses image summary", () => {
    const model = buildActivityViewModel(message([readPart("r", "shot.png")]));
    assert.match(model.summaryLabel, /查看 1 张图片/);
  }],
  ["F27 technical payload is redacted", () => {
    const sanitized = sanitizeActivityDetail({ token: "secret-value", nested: { authorization: "Bearer abcdefghijkl" } }) as Record<string, unknown>;
    assert.equal(sanitized.token, "[REDACTED]");
    assert.equal((sanitized.nested as Record<string, unknown>).authorization, "[REDACTED]");
  }],
  ["F28 result sequence keeps stream order", () => {
    const model = buildTurnViewModel(message([
      { id: "image", zone: "summary", kind: "image", src: "/a.png", streamSeq: 1 },
      { id: "text", zone: "summary", kind: "summary", markdown: "正文", streamSeq: 2 },
      { id: "outline", zone: "summary", kind: "writing_outline", markdown: "大纲", streamSeq: 3 },
    ]));
    assert.deepEqual(model.resultItems.map((item) => item.type === "answer" ? "answer" : item.part.kind), ["image", "answer"]);
    assert.equal(model.activity.timelineNodes.at(-1)?.type, "checkpoint");
  }],
  ["F29 simulation selector consumes activity parts", () => {
    const selected = selectSimulationTopicAnalysisActivity([message([readPart("r", "a.ts")])]);
    assert.equal(selected?.activityParts[0]?.kind, "file_read");
  }],
  ["F30 repeated builds are idempotent", () => {
    const msg = message([readPart("r", "a.ts"), editPart("e", "a.ts")]);
    assert.deepEqual(buildTurnViewModel(msg), buildTurnViewModel(msg));
  }],
  ["F31 running stage has highest priority", () => {
    const model = buildActivityViewModel(message([statusPart("s", "正在验证"), readPart("r", "a.ts")], "streaming"));
    assert.equal(model.summarySegments.toSorted((a, b) => b.priority - a.priority)[0]?.kind, "stage");
  }],
  ["F32 completed failure keeps failure priority", () => {
    const model = buildActivityViewModel(message([
      editPart("e", "a.ts"),
      { id: "x", zone: "activity", kind: "tool", tool: "Bash", status: "error", input: { command: "false" } },
    ]));
    const failure = model.summarySegments.find((segment) => segment.kind === "error");
    assert.ok(failure && failure.priority >= 90);
  }],
  ["F33 waiting state leads summary", () => {
    const model = buildActivityViewModel(message([
      { id: "req", zone: "summary", kind: "writing_requirements", title: "请选择模板", questions: [] },
      readPart("r", "a.ts"),
    ]));
    assert.equal(model.state, "waiting_user");
    assert.equal(model.summarySegments[0]?.kind, "stage");
  }],
  ["F34 episodes preserve narration order", () => {
    const parts: ChatPart[] = [
      { id: "n1", zone: "activity", kind: "narration", markdown: "读取当前实现", streamSeq: 1 },
      readPart("r", "a.ts", 2),
      { id: "n2", zone: "activity", kind: "narration", markdown: "修改人物形象", streamSeq: 3 },
      editPart("e", "a.ts", 4),
      { id: "n3", zone: "activity", kind: "narration", markdown: "验证修改", streamSeq: 5 },
      { id: "c", zone: "activity", kind: "command", command: "pnpm test", streamSeq: 6 },
    ];
    const model = buildActivityViewModel(message(parts));
    assert.deepEqual(model.episodes.map((episode) => episode.label), ["读取当前实现", "修改人物形象", "验证修改"]);
    assert.deepEqual(
      model.episodes.map((episode) => episode.narrations.map((item) => item.markdown)),
      [["读取当前实现"], ["修改人物形象"], ["验证修改"]],
    );
    assert.equal(model.technicalParts.some((part) => part.kind === "narration"), false);
    assert.equal(model.latestNarrationPreview, "验证修改");
  }],
  ["F35 same file remains in separate episodes", () => {
    const parts = [statusPart("s1", "读取实现", 1), readPart("r1", "a.ts", 2), statusPart("s2", "验证结果", 3), readPart("r2", "a.ts", 4)];
    const model = buildActivityViewModel(message(parts));
    assert.equal(model.episodes.length, 2);
    assert.match(model.summaryLabel, /读取 1 个文件/);
  }],
  ["F36 duplicate markers merge", () => {
    const parts = [statusPart("s1", "读取实现", 1), statusPart("s2", "读取实现", 2), readPart("r", "a.ts", 3)];
    assert.equal(buildActivityViewModel(message(parts)).episodes.length, 1);
  }],
  ["F37 generic narration does not create episode", () => {
    const parts: ChatPart[] = [
      { id: "n", zone: "activity", kind: "narration", markdown: "好的" },
      readPart("r", "a.ts"),
    ];
    const model = buildActivityViewModel(message(parts));
    assert.equal(model.episodes[0]?.label, "读取与查看");
    assert.equal(model.episodes[0]?.narrations.length, 0);
    assert.equal(model.debugParts.some((part) => part.kind === "narration"), true);
  }],
  ["F38 ambiguous provider text remains result", () => {
    const model = buildTurnViewModel(message([
      { id: "t", zone: "summary", kind: "text", markdown: "我先读取文件" },
    ]));
    const answer = model.resultItems.find((item) => item.type === "answer");
    assert.equal(answer?.type === "answer" && answer.markdown, "我先读取文件");
  }],
  ["F39 legacy structured checkpoint remains visible", () => {
    const model = buildTurnViewModel(message([
      {
        id: "legacy-outline",
        kind: "writing_outline",
        title: "历史大纲",
        markdown: "## 历史大纲",
      },
    ]));
    assert.equal(model.activity.timelineNodes[0]?.type, "checkpoint");
    assert.equal(
      model.activity.timelineNodes[0]?.type === "checkpoint" &&
        model.activity.timelineNodes[0].part.kind,
      "writing_outline",
    );
  }],
  ["F40 activity evidence labels redact inline secrets", () => {
    const model = buildActivityViewModel(message([
      {
        id: "secret-command",
        zone: "activity",
        kind: "command",
        command: "curl -H 'Authorization: Bearer abcdefghijklmnop' https://example.test",
      },
    ]));
    const occurrence = model.episodes[0]?.occurrences[0];
    assert.ok(occurrence?.resourceLabel?.includes("[REDACTED]"));
    assert.ok(!occurrence?.resourceLabel?.includes("abcdefghijklmnop"));
  }],
  ["F41 narration-only episode remains visible", () => {
    const model = buildActivityViewModel(message([
      { id: "n", zone: "activity", kind: "narration", markdown: "我先确认市场需求口径，再对照现有素材。" },
    ]));
    assert.equal(model.episodes.length, 1);
    assert.equal(model.episodes[0]?.narrations[0]?.markdown.includes("市场需求口径"), true);
    assert.equal(model.preferExpanded, false);
  }],
  ["F42 running prefers expanded process", () => {
    const model = buildActivityViewModel(message([
      { id: "n", zone: "activity", kind: "narration", markdown: "正在核对口径" },
      readPart("r", "a.ts"),
    ], "streaming"));
    assert.equal(model.preferExpanded, true);
    assert.equal(model.state, "running");
  }],
  ["F43 process timeline preserves cross-family time order", () => {
    const model = buildActivityViewModel(message([
      { id: "n1", zone: "activity", kind: "narration", markdown: "先验证", streamSeq: 1 },
      { id: "c", zone: "activity", kind: "command", command: "pnpm test", streamSeq: 2 },
      readPart("r", "src/a.ts", 3),
      { id: "n2", zone: "activity", kind: "narration", markdown: "再修改", streamSeq: 4 },
      editPart("e", "src/a.ts", 5),
    ], "streaming"));
    assert.deepEqual(
      model.timelineNodes.map((node) => node.type),
      ["narration", "actions", "narration", "actions"],
    );
    const firstActions = model.timelineNodes[1];
    assert.equal(firstActions?.type, "actions");
    assert.deepEqual(
      firstActions?.type === "actions"
        ? firstActions.occurrences.map((item) => item.family)
        : [],
      ["command", "read"],
    );
  }],
  ["F44 pending segment commits to process in place", () => {
    let state = initAssistantPartsState();
    state = reduceAssistantSegment(state, {
      segmentId: "claude-1",
      operation: "delta",
      role: "pending",
      text: "我先读取文件",
    });
    const seq = state.parts[0]?.streamSeq;
    state = reduceAssistantSegment(state, {
      segmentId: "claude-1",
      operation: "commit",
      role: "process",
    });
    assert.equal(state.parts[0]?.kind, "narration");
    assert.equal(state.parts[0]?.streamSeq, seq);
    assert.equal(state.finalAnswerStarted, false);
  }],
  ["F45 pending segment commits to final and collapses once", () => {
    let state = initAssistantPartsState();
    state = reduceAssistantSegment(state, {
      segmentId: "claude-final",
      operation: "delta",
      role: "pending",
      text: "最终回答",
    });
    state = reduceAssistantSegment(state, {
      segmentId: "claude-final",
      operation: "commit",
      role: "final",
    });
    assert.equal(state.parts[0]?.kind, "text");
    assert.equal(state.parts[0]?.presentationRole, "result");
    assert.equal(state.activityCollapse, "collapsed");
    assert.equal(state.finalCollapseRevision, 1);
  }],
  ["F46 user reopen after final commit survives later patch", () => {
    let state = reduceAssistantSegment(initAssistantPartsState(), {
      segmentId: "final",
      operation: "commit",
      role: "final",
      text: "回答",
    });
    const collapsed = applyPartsStateToMessage(
      message([], "streaming", { activityCollapse: "user_expanded" }),
      state,
    );
    assert.equal(collapsed.activityCollapse, "collapsed");
    const reopened = { ...collapsed, activityCollapse: "user_expanded" as const };
    state = { ...state, parts: [...state.parts, readPart("r", "a.ts", 2)] };
    assert.equal(
      applyPartsStateToMessage(reopened, state).activityCollapse,
      "user_expanded",
    );
  }],
  ["F47 final segment ends live detail expansion", () => {
    const model = buildActivityViewModel(message([
      { id: "n", zone: "activity", kind: "narration", markdown: "先检查", streamSeq: 1 },
      {
        id: "f",
        zone: "summary",
        kind: "text",
        markdown: "完成",
        segmentId: "final",
        presentationRole: "result",
        streamSeq: 2,
      },
    ], "streaming"));
    assert.equal(model.finalAnswerStarted, true);
    assert.equal(model.detailsExpanded, false);
    assert.equal(model.preferExpanded, false);
  }],
  ["F48 legacy text delta starts final answer without segment id", () => {
    const state = reduceTextDelta(initAssistantPartsState(), "旧协议最终回答");
    const nextMessage = applyPartsStateToMessage(
      message([], "streaming", { activityCollapse: "expanded" }),
      state,
    );
    const activity = buildActivityViewModel(nextMessage);
    assert.equal(activity.finalAnswerStarted, true);
    assert.equal(activity.preferExpanded, false);
    assert.equal(nextMessage.activityCollapse, "collapsed");
  }],
  ["F49 committed final stays final while run is streaming", () => {
    let state = reduceAssistantSegment(initAssistantPartsState(), {
      segmentId: "final-streaming-message",
      operation: "delta",
      role: "pending",
      text: "最终回答",
    });
    state = reduceAssistantSegment(state, {
      segmentId: "final-streaming-message",
      operation: "commit",
      role: "final",
    });
    const model = buildTurnViewModel(
      applyPartsStateToMessage(message([], "streaming"), state),
    );
    const answer = model.resultItems.find((item) => item.type === "answer");
    assert.equal(model.answerPhase, "final");
    assert.equal(answer?.type === "answer" && answer.streaming, false);
  }],
  ["F50 Codex parser assigns process and final roles", () => {
    const events: AgentStreamEvent[] = [];
    const parser = createCodexJsonParser((event) => events.push(event));
    parser.feed(`${JSON.stringify({
      type: "item.completed",
      item: {
        id: "codex-process",
        type: "agent_message",
        phase: "commentary",
        text: "我先检查实现",
      },
    })}\n`);
    parser.feed(`${JSON.stringify({
      type: "item.completed",
      item: {
        id: "codex-final",
        type: "agent_message",
        phase: "final_answer",
        text: "检查完成",
      },
    })}\n`);
    parser.flush();
    const segments = events.filter((event) => event.type === "assistant_segment");
    assert.deepEqual(
      segments.map((event) =>
        event.type === "assistant_segment"
          ? [event.segmentId, event.operation, event.role, event.text]
          : null,
      ),
      [
        ["codex-process", "commit", "process", "我先检查实现"],
        ["codex-final", "commit", "final", "检查完成"],
      ],
    );
  }],
  ["F51 Claude parser commits tool turn as process and last turn as final", () => {
    const events: AgentStreamEvent[] = [];
    const parser = createClaudeJsonlParser((event) => events.push(event));
    const feed = (event: unknown) =>
      parser.feed(`${JSON.stringify({ type: "stream_event", event })}\n`);

    feed({ type: "message_start", message: { id: "claude-process" } });
    feed({
      type: "content_block_start",
      index: 0,
      content_block: { type: "text" },
    });
    feed({
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "我先读取文件" },
    });
    feed({
      type: "content_block_start",
      index: 1,
      content_block: {
        type: "tool_use",
        id: "tool-1",
        name: "Read",
        input: { file_path: "src/app.ts" },
      },
    });
    feed({ type: "message_delta", delta: { stop_reason: "tool_use" } });

    feed({ type: "message_start", message: { id: "claude-final" } });
    feed({
      type: "content_block_start",
      index: 0,
      content_block: { type: "text" },
    });
    feed({
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "已经完成" },
    });
    feed({ type: "message_delta", delta: { stop_reason: "end_turn" } });
    parser.flush();

    const segments = events.filter((event) => event.type === "assistant_segment");
    assert.deepEqual(
      segments.map((event) =>
        event.type === "assistant_segment"
          ? [event.segmentId, event.operation, event.role, event.text]
          : null,
      ),
      [
        ["claude-message-claude-process", "delta", "pending", "我先读取文件"],
        ["claude-message-claude-process", "commit", "process", undefined],
        ["claude-message-claude-final", "delta", "pending", "已经完成"],
        ["claude-message-claude-final", "commit", "final", undefined],
      ],
    );
  }],
  ["F52 final commit marks buffered output and supports legacy callbacks", () => {
    const state = {
      textEmitted: false,
      hasFinalText: false,
      assistantSegments: new Map<
        string,
        {
          text: string;
          forwardedFinalLength: number;
          forwardedProcessLength: number;
        }
      >(),
    };
    const finalText: string[] = [];
    const narration: string[] = [];
    const callbacks = {
      onText: (text: string) => finalText.push(text),
      onNarration: (text: string) => narration.push(text),
    };
    defaultOnEvent(
      {
        type: "assistant_segment",
        segmentId: "buffered-final",
        operation: "delta",
        role: "pending",
        text: "缓冲回答",
      },
      state,
      callbacks,
    );
    assert.equal(state.textEmitted, false);
    defaultOnEvent(
      {
        type: "assistant_segment",
        segmentId: "buffered-final",
        operation: "commit",
        role: "final",
      },
      state,
      callbacks,
    );
    assert.equal(state.textEmitted, true);
    assert.deepEqual(narration, []);
    assert.deepEqual(finalText, ["缓冲回答"]);

    defaultOnEvent(
      {
        type: "assistant_segment",
        segmentId: "buffered-process",
        operation: "delta",
        role: "pending",
        text: "缓冲过程",
      },
      state,
      callbacks,
    );
    assert.deepEqual(narration, []);
    defaultOnEvent(
      {
        type: "assistant_segment",
        segmentId: "buffered-process",
        operation: "commit",
        role: "process",
      },
      state,
      callbacks,
    );
    assert.deepEqual(narration, ["缓冲过程"]);

    defaultOnEvent(
      {
        type: "assistant_segment",
        segmentId: "second-final",
        operation: "commit",
        role: "final",
        text: "第二段回答",
      },
      state,
      callbacks,
    );
    assert.deepEqual(finalText, ["缓冲回答", "\n\n第二段回答"]);
  }],
  ["F53 legacy streaming result remains provisional", () => {
    const state = reduceTextDelta(initAssistantPartsState(), "仍在生成");
    const model = buildTurnViewModel(
      applyPartsStateToMessage(message([], "streaming"), state),
    );
    const answer = model.resultItems.find((item) => item.type === "answer");
    assert.equal(model.answerPhase, "provisional");
    assert.equal(answer?.type === "answer" && answer.streaming, true);
  }],
  ["F54 process timeline aggregates repeated actions inside one group", () => {
    const model = buildActivityViewModel(message([
      {
        id: "n1",
        zone: "activity",
        kind: "narration",
        markdown: "先读取实现",
        streamSeq: 1,
      },
      readPart("r1", "src/a.ts", 2),
      readPart("r2", "src/a.ts", 3),
      readPart("r3", "src/b.ts", 4),
      {
        id: "n2",
        zone: "activity",
        kind: "narration",
        markdown: "读取完成，继续修改",
        streamSeq: 5,
      },
    ]));
    const actions = model.timelineNodes.find((node) => node.type === "actions");
    assert.equal(actions?.type, "actions");
    assert.deepEqual(
      actions?.type === "actions"
        ? actions.occurrences.map((item) => [item.resourceKey, item.count])
        : [],
      [
        ["src/a.ts", 2],
        ["src/b.ts", 1],
      ],
    );
  }],
  ["F55 exceptional states reopen process after final starts", () => {
    for (const state of ["waiting_user", "error", "cancelled"] as const) {
      assert.equal(
        resolveActivityProcessExpanded("collapsed", state, true),
        true,
      );
    }
    assert.equal(
      resolveActivityProcessExpanded("user_collapsed", "error", true),
      false,
    );
  }],
  ["F56 Hermes tool completion commits preceding text as process", async () => {
    const originalFetch = globalThis.fetch;
    const segments: AgentStreamEvent[] = [];
    const toolProgress: Array<{
      tool: string;
      status?: string;
      message?: string;
      callId?: string;
      input?: unknown;
      output?: unknown;
    }> = [];
    const body = [
      `data: ${JSON.stringify({
        choices: [{ delta: { content: "先检查文件" } }],
      })}`,
      "event: hermes.tool.progress",
      `data: ${JSON.stringify({
        tool: "Read",
        status: "running",
        toolCallId: "read-1",
        label: "src/app.ts",
      })}`,
      "event: hermes.tool.progress",
      `data: ${JSON.stringify({
        tool: "Read",
        status: "completed",
        toolCallId: "read-1",
      })}`,
      `data: ${JSON.stringify({
        choices: [{ delta: { content: "已经完成" } }],
      })}`,
      "data: [DONE]",
      "",
    ].join("\n\n");
    globalThis.fetch = async () =>
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    try {
      const result = await runHermesGateway(
        {
          baseUrl: "http://hermes.test",
          model: "test",
          sessionKey: "fixture",
          messages: [{ role: "user", content: "检查文件" }],
        },
        {
          onText() {},
          onAssistantSegment: (event) =>
            segments.push({ type: "assistant_segment", ...event }),
          onToolProgress: (event) => toolProgress.push(event),
        },
      );
      assert.equal(result.exitCode, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.deepEqual(
      segments.map((event) =>
        event.type === "assistant_segment"
          ? [event.operation, event.role, event.text]
          : null,
      ),
      [
        ["delta", "pending", "先检查文件"],
        ["commit", "process", undefined],
        ["delta", "pending", "已经完成"],
        ["commit", "final", undefined],
      ],
    );
    assert.deepEqual(toolProgress, [
      {
        tool: "read_file",
        status: "running",
        message: "src/app.ts",
        callId: "read-1",
        input: undefined,
        output: undefined,
      },
      {
        tool: "read_file",
        status: "success",
        message: "src/app.ts",
        callId: "read-1",
        input: undefined,
        output: undefined,
      },
    ]);
  }],
  ["F57 legacy completed answer uses final process summary", () => {
    const activity = buildActivityViewModel(
      message([readPart("legacy-read", "src/legacy.ts")], "complete", {
        content: "旧版最终回答",
      }),
    );
    assert.equal(activity.finalAnswerStarted, true);
    assert.equal(activity.preferExpanded, false);
  }],
  ["F58 distinct final segments share canonical paragraph boundaries", () => {
    const state = createFinalSegmentAccumulator();
    const chunks = [
      appendFinalSegment(state, {
        segmentId: "final-1",
        role: "final",
        text: "\n\n第一段",
      }),
      appendFinalSegment(state, {
        segmentId: "final-1",
        role: "final",
        text: "继续",
      }),
      appendFinalSegment(state, {
        segmentId: "final-2",
        role: "pending",
        text: "第二段",
      }),
      appendFinalSegment(state, {
        segmentId: "final-2",
        role: "final",
      }),
    ];
    assert.equal(chunks.join(""), "第一段继续\n\n第二段");
  }],
  ["F59 adjacent reasoning lifecycles remain separate and ordered", () => {
    let state = initAssistantPartsState();
    state = reduceToolProgress(state, {
      tool: "reasoning",
      status: "running",
      message: "思考中",
    });
    state = reduceToolProgress(state, {
      tool: "reasoning",
      status: "running",
      message: "先确定搜索范围。",
    });
    state = reduceToolProgress(state, {
      tool: "reasoning",
      status: "success",
      message: "思考中",
    });
    state = reduceToolProgress(state, {
      tool: "reasoning",
      status: "running",
      message: "思考中",
    });
    state = reduceToolProgress(state, {
      tool: "reasoning",
      status: "running",
      message: "根据结果补充举办地信息。",
    });
    state = reduceToolProgress(state, {
      tool: "reasoning",
      status: "success",
      message: "思考中",
    });

    const reasoning = state.parts.filter(
      (part): part is Extract<ChatPart, { kind: "reasoning" }> =>
        part.kind === "reasoning",
    );
    assert.deepEqual(
      reasoning.map((part) => [part.markdown, part.streaming]),
      [
        ["先确定搜索范围。", false],
        ["根据结果补充举办地信息。", false],
      ],
    );
    assert.ok((reasoning[0]?.streamSeq ?? -1) < (reasoning[1]?.streamSeq ?? -1));
  }],
  ["F60 empty reasoning lifecycle does not leave a blank process node", () => {
    let state = reduceToolProgress(initAssistantPartsState(), {
      tool: "reasoning",
      status: "running",
      message: "思考中",
    });
    state = reduceToolProgress(state, {
      tool: "reasoning",
      status: "success",
      message: "思考中",
    });
    assert.equal(state.parts.some((part) => part.kind === "reasoning"), false);
    assert.equal(
      buildActivityViewModel(message(state.parts)).timelineNodes.length,
      0,
    );
  }],
  ["F61 read lifecycle updates one call in place", () => {
    let state = initAssistantPartsState();
    state = reduceToolProgress(state, {
      tool: "Read",
      status: "running",
      callId: "read-1",
      input: { file_path: "src/app.ts" },
      streamSeq: 40,
    });
    state = reduceToolProgress(state, {
      tool: "Read",
      status: "success",
      callId: "read-1",
      input: { file_path: "src/app.ts" },
      streamSeq: 41,
    });
    const reads = state.parts.filter(
      (part) => part.kind === "file_read" || part.kind === "document_read",
    );
    assert.equal(reads.length, 1);
    assert.equal(reads[0]?.callId, "read-1");
    assert.equal(reads[0]?.status, "success");
    assert.equal(reads[0]?.streaming, false);
    assert.equal(reads[0]?.streamSeq, 40);
  }],
  ["F62 edit lifecycle updates one call in place", () => {
    let state = initAssistantPartsState();
    state = reduceToolProgress(state, {
      tool: "Edit",
      status: "running",
      callId: "edit-1",
      input: { file_path: "src/app.ts" },
      streamSeq: 50,
    });
    state = reduceToolProgress(state, {
      tool: "Edit",
      status: "error",
      callId: "edit-1",
      input: { file_path: "src/app.ts" },
      streamSeq: 51,
    });
    const edits = state.parts.filter(
      (part) => part.kind === "file_edit" || part.kind === "document_edit",
    );
    assert.equal(edits.length, 1);
    assert.equal(edits[0]?.callId, "edit-1");
    assert.equal(edits[0]?.status, "error");
    assert.equal(edits[0]?.streaming, false);
  }],
  ["F63 concurrent commands finish by call id", () => {
    let state = initAssistantPartsState();
    state = reduceToolProgress(state, {
      tool: "Bash",
      status: "running",
      callId: "cmd-a",
      input: { command: "pnpm test:a" },
      streamSeq: 60,
    });
    state = reduceToolProgress(state, {
      tool: "Bash",
      status: "running",
      callId: "cmd-b",
      input: { command: "pnpm test:b" },
      streamSeq: 61,
    });
    state = reduceToolProgress(state, {
      tool: "Bash",
      status: "success",
      callId: "cmd-b",
      input: { command: "pnpm test:b" },
      streamSeq: 62,
    });
    state = reduceToolProgress(state, {
      tool: "Bash",
      status: "error",
      callId: "cmd-a",
      input: { command: "pnpm test:a" },
      streamSeq: 63,
    });
    const commands = state.parts.filter((part) => part.kind === "command");
    assert.equal(commands.length, 2);
    assert.equal(commands.find((part) => part.callId === "cmd-a")?.status, "error");
    assert.equal(commands.find((part) => part.callId === "cmd-b")?.status, "success");
    const tools = state.parts.filter((part) => part.kind === "tool");
    assert.equal(tools.find((part) => part.callId === "cmd-a")?.status, "error");
    assert.equal(tools.find((part) => part.callId === "cmd-b")?.status, "success");
  }],
  ["F64 repeated resource calls keep separate timeline positions", () => {
    let state = initAssistantPartsState();
    state = reduceToolProgress(state, {
      tool: "Read",
      status: "running",
      callId: "read-a",
      message: "src/app.ts",
      streamSeq: 70,
    });
    state = reduceToolProgress(state, {
      tool: "Read",
      status: "success",
      callId: "read-a",
      message: "src/app.ts",
      streamSeq: 71,
    });
    state = reduceToolProgress(state, {
      tool: "Read",
      status: "running",
      callId: "read-b",
      message: "src/app.ts",
      streamSeq: 72,
    });
    state = reduceToolProgress(state, {
      tool: "Read",
      status: "success",
      callId: "read-b",
      message: "src/app.ts",
      streamSeq: 73,
    });
    const reads = state.parts.filter((part) => part.kind === "file_read");
    assert.equal(reads.length, 2);
    assert.deepEqual(reads.map((part) => part.streamSeq), [70, 72]);
  }],
  ["F65 non-adjacent repeated resources preserve action order", () => {
    const model = buildActivityViewModel(message([
      {
        id: "n1",
        zone: "activity",
        kind: "narration",
        markdown: "先读取两个文件",
        streamSeq: 1,
      },
      readPart("r-a-1", "src/a.ts", 2),
      readPart("r-b", "src/b.ts", 3),
      readPart("r-a-2", "src/a.ts", 4),
      {
        id: "n2",
        zone: "activity",
        kind: "narration",
        markdown: "读取完成",
        streamSeq: 5,
      },
    ]));
    const actions = model.timelineNodes.find((node) => node.type === "actions");
    assert.equal(actions?.type, "actions");
    assert.deepEqual(
      actions?.type === "actions"
        ? actions.occurrences.map((item) => [item.resourceKey, item.count])
        : [],
      [
        ["src/a.ts", 1],
        ["src/b.ts", 1],
        ["src/a.ts", 1],
      ],
    );
  }],
  ["F66 persisted run events restore the full business timeline", () => {
    const runId = "history-run";
    const events: RunEvent[] = [
      {
        type: "run.started",
        runId,
        cwd: "/tmp/project",
        agentId: "claude",
        streamSeq: 1,
      },
      {
        type: "assistant.segment",
        runId,
        segmentId: "history-process",
        operation: "commit",
        role: "process",
        text: "先读取实现，再给出结论。",
        streamSeq: 2,
      },
      {
        type: "tool.progress",
        runId,
        callId: "history-read",
        toolCallId: "history-read",
        tool: "Read",
        status: "running",
        input: { file_path: "src/history.ts" },
        streamSeq: 3,
      },
      {
        type: "tool.progress",
        runId,
        callId: "history-read",
        toolCallId: "history-read",
        tool: "Read",
        status: "done",
        input: { file_path: "src/history.ts" },
        output: "export const restored = true;",
        streamSeq: 4,
      },
      {
        type: "assistant.segment",
        runId,
        segmentId: "history-final",
        operation: "commit",
        role: "final",
        text: "历史回放完成。",
        streamSeq: 5,
      },
      { type: "run.finished", runId, streamSeq: 6 },
    ];
    const record: RunRecord = {
      runId,
      tenantId: "local",
      projectId: "project",
      workspaceId: "workspace",
      sessionId: "session",
      turnId: "turn-history-run",
      agentId: "claude",
      agentModel: "default",
      status: "completed",
      queuePolicy: "interrupt",
      createdAt: new Date(0).toISOString(),
    };
    const restored = applyRunEventsToMessage(
      message([], "streaming", { runId }),
      events,
      record,
    );
    const model = buildTurnViewModel(restored);
    assert.deepEqual(
      model.activity.timelineNodes.map((node) => node.type),
      ["narration", "actions"],
    );
    assert.equal(model.activity.occurrences.length, 1);
    assert.equal(model.activity.occurrences[0]?.resourceKey, "src/history.ts");
    assert.equal(model.activity.occurrences[0]?.status, "success");
    assert.equal(model.activity.occurrences[0]?.firstStreamSeq, 3);
    assert.equal(restored.content, "历史回放完成。");
    assert.equal(model.resultItems.filter((item) => item.type === "answer").length, 1);
  }],
  ["F67 part patches preserve the first timeline position", () => {
    const runId = "patch-run";
    const restored = applyRunEventsToMessage(
      message([], "streaming", { runId }),
      [
        {
          type: "part.append",
          runId,
          part: readPart("patched-read", "src/original.ts", 10),
          streamSeq: 10,
        },
        {
          type: "part.patch",
          runId,
          id: "patched-read",
          merge: { status: "success", streamSeq: 20 },
          streamSeq: 20,
        },
      ],
    );
    assert.equal(restored.parts?.[0]?.streamSeq, 10);
  }],
  ["F68 companion session parsing preserves collapse ownership", () => {
    const parsed = parseMessages({
      messages: [
        {
          id: "persisted-assistant",
          role: "assistant",
          content: "已完成",
          status: "complete",
          activityCollapse: "user_expanded",
          finalCollapseRevision: 1,
          parts: [readPart("persisted-read", "src/persisted.ts", 1)],
        },
      ],
    });
    assert.equal(parsed?.[0]?.activityCollapse, "user_expanded");
    assert.equal(parsed?.[0]?.finalCollapseRevision, 1);
    assert.equal(parsed?.[0]?.parts?.length, 1);
  }],
  ["F69 Codex command completion preserves aggregated output", () => {
    const events: AgentStreamEvent[] = [];
    const parser = createCodexJsonParser((event) => events.push(event));
    parser.feed(`${JSON.stringify({
      type: "item.started",
      item: {
        id: "codex-command-output",
        type: "command_execution",
        command: "/bin/zsh -lc pwd",
        status: "in_progress",
      },
    })}\n`);
    parser.feed(`${JSON.stringify({
      type: "item.completed",
      item: {
        id: "codex-command-output",
        type: "command_execution",
        command: "/bin/zsh -lc pwd",
        aggregated_output: "/tmp/sandbox-default\n",
        exit_code: 0,
        status: "completed",
      },
    })}\n`);
    parser.flush();
    const lifecycle = events.filter(
      (event) => event.type === "tool_progress" && event.callId === "codex-command-output",
    );
    assert.equal(lifecycle.length, 2);
    assert.deepEqual(
      lifecycle.map((event) =>
        event.type === "tool_progress"
          ? [event.status, event.input, event.output]
          : null,
      ),
      [
        ["running", { command: "/bin/zsh -lc pwd" }, undefined],
        ["success", { command: "/bin/zsh -lc pwd" }, "/tmp/sandbox-default\n"],
      ],
    );
  }],
  ["F70 unphased Codex text stays pending until action or turn completion", () => {
    const events: AgentStreamEvent[] = [];
    const parser = createCodexJsonParser((event) => events.push(event));
    const feed = (event: unknown) =>
      parser.feed(`${JSON.stringify(event)}\n`);

    feed({
      type: "item.completed",
      item: {
        id: "codex-unphased-process",
        type: "agent_message",
        text: "我先检查当前目录",
      },
    });
    feed({
      type: "item.started",
      item: {
        id: "codex-unphased-command",
        type: "command_execution",
        command: "pwd",
        status: "in_progress",
      },
    });
    feed({
      type: "item.completed",
      item: {
        id: "codex-unphased-command",
        type: "command_execution",
        command: "pwd",
        aggregated_output: "/tmp/project\n",
        exit_code: 0,
        status: "completed",
      },
    });
    feed({
      type: "item.completed",
      item: {
        id: "codex-unphased-final",
        type: "agent_message",
        text: "检查完成",
      },
    });
    feed({ type: "turn.completed" });
    parser.flush();

    const segments = events.filter(
      (event) => event.type === "assistant_segment",
    );
    assert.deepEqual(
      segments.map((event) =>
        event.type === "assistant_segment"
          ? [event.segmentId, event.operation, event.role, event.text]
          : null,
      ),
      [
        ["codex-unphased-process", "delta", "pending", "我先检查当前目录"],
        ["codex-unphased-process", "commit", "process", undefined],
        ["codex-unphased-final", "delta", "pending", "检查完成"],
        ["codex-unphased-final", "commit", "final", undefined],
      ],
    );
  }],
  ["F71 Hermes CLI fallback uses non-interactive oneshot mode", () => {
    const spec = buildLaunchSpec("hermes", {
      cwd: "/tmp/sandbox-default",
      agentModel: "default",
      composedPrompt: "只回答：好",
    });
    assert.deepEqual(spec.args, [
      "--oneshot",
      "只回答：好",
      "--yolo",
      "--accept-hooks",
    ]);
    assert.equal(spec.streamFormat, "plain");
    assert.equal(spec.promptViaArgs, true);
    assert.equal(spec.stdinPayload, "ignore");
    assert.equal(spec.promptArgvRejected, undefined);

    const oversized = buildLaunchSpec("hermes", {
      cwd: "/tmp/sandbox-default",
      agentModel: "default",
      composedPrompt: "x".repeat(28_001),
    });
    assert.equal(oversized.promptArgvRejected, true);
  }],
  ["F72 Hermes CLI does not turn provider failures into final answers", () => {
    const events: AgentStreamEvent[] = [];
    const parser = createHermesPlainParser((event) => events.push(event));
    parser.feed(
      "API call failed after 3 retries: HTTP 404: Internal server error\n",
    );
    parser.flush();
    assert.deepEqual(events, [
      {
        type: "error",
        code: "hermes_cli_error",
        message:
          "API call failed after 3 retries: HTTP 404: Internal server error",
      },
    ]);
  }],
  ["F73 duplicate terminal errors produce one process node", () => {
    const first = reduceStreamError(
      initAssistantPartsState(),
      "Provider unavailable",
      "provider_error",
    );
    const second = reduceStreamError(
      first,
      "Provider unavailable",
      "provider_error",
    );
    assert.equal(
      second.parts.filter((part) => part.kind === "error").length,
      1,
    );
    assert.equal(second.activityCollapse, "expanded");
  }],
];

async function main() {
  for (const [name, test] of tests) {
    try {
      await test();
      console.log(`PASS ${name}`);
    } catch (error) {
      console.error(`FAIL ${name}`);
      throw error;
    }
  }

  console.log(`PASS all ${tests.length} chat activity fixtures`);
}

void main();
