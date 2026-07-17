import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import type { ChatMessage } from "../web/src/lib/chat";
import type { CanonicalTurnOutput, ChatPart } from "../web/src/lib/chat-parts";
import {
  buildActivityViewModel,
  buildActivityOccurrences,
} from "../web/src/lib/chat-activity-view-model";
import { sanitizeActivityDetail } from "../web/src/lib/activity-detail-sanitize";
import {
  applyPartsStateToMessage,
  initAssistantPartsState,
  reduceStreamFinished,
} from "../web/src/lib/chat-parts-reducer";
import { buildTurnViewModel } from "../web/src/lib/chat-turn-view-model";
import { resolveTurnDisplayState } from "../web/src/lib/chat-turn-display-state";
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

const tests: Array<[string, () => void]> = [
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
  ["F11 reasoning stays in thinking bucket", () => {
    const model = buildActivityViewModel(message([
      { id: "reason", zone: "activity", kind: "reasoning", markdown: "private analysis" },
    ]));
    assert.equal(model.reasoningParts[0]?.kind, "reasoning");
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
  ["F16 requirements remain interactive result", () => {
    const model = buildTurnViewModel(message([
      { id: "req", zone: "summary", kind: "writing_requirements", title: "写作要求", questions: [] },
    ]));
    assert.equal(model.state, "waiting_user");
    assert.equal(model.resultItems[0]?.type, "part");
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
    assert.deepEqual(model.resultItems.map((item) => item.type === "answer" ? "answer" : item.part.kind), ["image", "answer", "writing_outline"]);
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
  ["F39 legacy structured result without zone remains visible", () => {
    const model = buildTurnViewModel(message([
      {
        id: "legacy-outline",
        kind: "writing_outline",
        title: "历史大纲",
        markdown: "## 历史大纲",
      },
    ]));
    assert.equal(model.resultItems[0]?.type, "part");
    assert.equal(
      model.resultItems[0]?.type === "part" && model.resultItems[0].part.kind,
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
];

for (const [name, test] of tests) {
  try {
    test();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

console.log(`PASS all ${tests.length} chat activity fixtures`);
