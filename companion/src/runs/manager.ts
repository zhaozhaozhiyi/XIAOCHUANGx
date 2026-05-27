import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";
import {
  applyTranscriptScope,
  buildDeliverablesFromDiff,
  buildHermesSessionKey,
  composeAgentRunPayload,
  exceedsHardPromptLimit,
  extractPathFromToolMessage,
  loadSkillBundle,
  prepareMessagesForRun,
  probeHermesGateway,
  resolveChatOrchestration,
  resolvePromptsRoot,
  resolveSkillsRoot,
  runAgent,
  runHermesGateway,
  snapshotWorkspace,
  stageAgentKitForRun,
  type ChatOrchestration,
  type RunConversationMessage,
  type RunAgentUserInputResponse,
} from "@jlc/runtime-core";
import {
  getAgentRegistryEntry,
  normalizeChatMode,
  type ChatModeId,
  type RunAgentResult,
} from "@jlc/runtime-core";
import { detectAllAgents, findAgentState } from "../agents/detect.js";
import { config } from "../config.js";
import { resolveWorkspaceRoot } from "../projects/store.js";
import { clearAgentThread, saveAgentThread } from "../sessions/cli-threads.js";
import {
  loadSessionRunContext,
  saveSessionRunContext,
} from "../sessions/run-context.js";
import type { CreateRunRequest } from "../types.js";
import {
  type CanonicalArtifact,
  type CanonicalCitation,
  type CanonicalEvent,
  type CanonicalWorkspaceChange,
} from "@jlc/contracts";
import {
  emitCanonicalAssistantDelta,
  emitCanonicalOutput,
  emitCanonicalRunAccepted,
  emitCanonicalRunCancelled,
  emitCanonicalRunFailed,
  emitCanonicalRunFinished,
  emitCanonicalRunStarted,
  emitCanonicalToolProgress,
  emitCanonicalWorkspaceChange,
} from "./canonical-events.js";
import { buildCanonicalOutput } from "./canonical-output.js";
import { emitDeliverablesPart } from "./emit-deliverables.js";
import { buildSimulatedReply } from "./reply.js";
import { emitMessageInterim, emitRunStatus } from "./runtime-events.js";
import { createRuntimeStoreWriter } from "./runtime-store-writer.js";
import { createPersistedRunWriter } from "./session-persistence.js";
import { streamSimulatedActivity } from "./simulated-activity.js";
import {
  createNoopWriter,
  createSseWriter,
  sleep,
  type RunEventWriter,
} from "./sse.js";
import { trySpawnVersionProbe } from "./spawn.js";
import { primeRuntimeRunRecord } from "./runtime-store-writer.js";

const activeRuns = new Map<string, AbortController>();
const activeRunRequests = new Map<string, CreateRunRequest>();
const activeSessionRuns = new Map<string, string>();
const activeRunWriters = new Map<string, RunEventWriter>();
const activeRunUserInputHandlers = new Map<
  string,
  (response: RunAgentUserInputResponse) => boolean
>();
const pendingRunClarifications = new Map<
  string,
  {
    toolUseId: string;
    toolName: string;
    input: unknown;
    questions: Array<{
      id: string;
      question: string;
      header?: string;
      options?: Array<{ label: string; description?: string }>;
      multiSelect?: boolean;
    }>;
  }
>();

export function registerRun(runId: string, controller: AbortController): void {
  activeRuns.set(runId, controller);
}

export function cancelRun(runId: string): boolean {
  const c = activeRuns.get(runId);
  if (!c) return false;
  c.abort();
  activeRuns.delete(runId);
  return true;
}

export function isRunActive(runId: string): boolean {
  return activeRuns.has(runId);
}

export function getActiveRunRequest(runId: string): CreateRunRequest | null {
  return activeRunRequests.get(runId) ?? null;
}

export function submitRunClarification(
  runId: string,
  input: { toolUseId?: string; content: string },
): { ok: true } | { ok: false; error: string; message: string } {
  const pending = pendingRunClarifications.get(runId);
  if (!pending) {
    return {
      ok: false,
      error: "clarification_not_pending",
      message: "当前 Run 没有等待补充信息",
    };
  }
  const toolUseId = input.toolUseId ?? pending.toolUseId;
  if (toolUseId !== pending.toolUseId) {
    return {
      ok: false,
      error: "tool_use_mismatch",
      message: "补充信息对应的工具调用已过期",
    };
  }
  const handler = activeRunUserInputHandlers.get(runId);
  if (!handler) {
    return {
      ok: false,
      error: "run_not_resumable",
      message: "当前 Run 不支持继续写入工具结果",
    };
  }
  const accepted = handler({
    toolUseId,
    content: input.content,
  });
  if (!accepted) {
    return {
      ok: false,
      error: "resume_write_failed",
      message: "写回 Claude CLI 失败",
    };
  }
  pendingRunClarifications.delete(runId);
  const writer = activeRunWriters.get(runId);
  writer?.send("run.resumed", { runId });
  writer?.send("run.status", {
    runId,
    phase: "running",
    label: "已收到补充信息，正在继续执行…",
  });
  return { ok: true };
}

export function getActiveRunIdForSession(sessionId: string): string | null {
  return activeSessionRuns.get(sessionId) ?? null;
}

export function isSessionRunning(sessionId: string): boolean {
  return activeSessionRuns.has(sessionId);
}

function formatCliFailureMessage(
  bin: string,
  result: RunAgentResult,
  detail: string,
): string {
  const lines = [`[${bin}] ${detail}`];
  if (result.stderrTail) lines.push(result.stderrTail.trim());
  else if (result.emptyOutput && result.stdoutTail) {
    lines.push(`stdout: ${result.stdoutTail.trim().slice(0, 500)}`);
  }
  if (result.exitCode != null && result.exitCode !== 0) {
    lines.push(`exit code: ${result.exitCode}`);
  }
  return lines.join("\n");
}

function waitingUserLabel(message?: string): boolean {
  return !!message && /确认|填写|选择|审批|授权|需要您|请补充/.test(message);
}

function taskStartLabel(userText: string, agentId: string): string {
  const text = userText.toLowerCase();
  if (/(ppt|pptx|演示|幻灯片|deck|slides?)/i.test(text)) {
    return "正在梳理 PPT 需求，并准备生成可打开的演示文稿…";
  }
  if (/(报告|研报|分析|总结|研究)/.test(text)) {
    return "正在梳理资料与分析框架…";
  }
  return `正在运行 ${agentId}，解析任务并准备执行…`;
}

function canonicalTurnId(runId: string): string {
  return `turn-${runId}`;
}

function findLastUserMessageIndex(messages: CreateRunRequest["messages"]): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") return i;
  }
  return -1;
}

async function streamSimulatedReply(
  userText: string,
  mode: ChatModeId,
  agentId: CreateRunRequest["agentId"],
  writer: RunEventWriter,
  abort: AbortController,
  runId: string,
  input?: {
    sessionId?: string;
    agentModel?: string;
  },
): Promise<void> {
  const startedAt = Date.now();
  let assistantText = "";
  await streamSimulatedActivity(writer, mode, userText, abort, agentId);

  const fullText = buildSimulatedReply(userText, mode, agentId);
  const parts = fullText.match(/[\s\S]{1,36}/g) ?? [fullText];

  for (const part of parts) {
    if (abort.signal.aborted) break;
    assistantText += part;
    writer.send("message.delta", { content: part });
    emitCanonicalAssistantDelta(writer, { runId, text: part });
    await sleep(32);
  }

  if (abort.signal.aborted) {
    emitCanonicalOutput(writer, {
      runId,
      canonicalOutput: buildCanonicalOutput({
        sessionId: input?.sessionId ?? "simulated-session",
        turnId: canonicalTurnId(runId),
        runId,
        agentId,
        agentModel: input?.agentModel ?? "default",
        startedAt,
        finishedAt: Date.now(),
        finalAnswer: assistantText.trim() ? `${assistantText.trim()}\n\n（已中断）` : "（已中断）",
        outcome: { status: "cancelled", message: "Run cancelled" },
      }),
    });
    writer.send("run.cancelled", { runId });
    emitCanonicalRunCancelled(writer, { runId });
  } else {
    emitCanonicalOutput(writer, {
      runId,
      canonicalOutput: buildCanonicalOutput({
        sessionId: input?.sessionId ?? "simulated-session",
        turnId: canonicalTurnId(runId),
        runId,
        agentId,
        agentModel: input?.agentModel ?? "default",
        startedAt,
        finishedAt: Date.now(),
        finalAnswer: assistantText,
        outcome: { status: "success" },
      }),
    });
    writer.send("run.finished", { runId });
    emitCanonicalRunFinished(writer, { runId });
  }
}

async function executeRunLifecycle(
  req: CreateRunRequest,
  writer: RunEventWriter,
  runId: string,
): Promise<void> {
  const abort = new AbortController();
  registerRun(runId, abort);
  activeRunWriters.set(runId, writer);
  activeRunRequests.set(runId, {
    ...req,
    messages: [...req.messages],
  });
  activeSessionRuns.set(req.sessionId, runId);

  const agents = await detectAllAgents();
  const agent = findAgentState(agents.agents, req.agentId);
  const agentSpec = getAgentRegistryEntry(req.agentId);
  if (!agent || agent.status !== "available") {
    writer.send("run.error", {
      code: "agent_unavailable",
      message:
        agent?.hint ??
        `Agent ${req.agentId} 不可用（${agent?.status ?? "unknown"}）`,
    });
    emitCanonicalRunFailed(writer, {
      runId,
      code: "agent_unavailable",
      message:
        agent?.hint ??
        `Agent ${req.agentId} 不可用（${agent?.status ?? "unknown"}）`,
    });
    return;
  }

  let cwd: string;
  try {
    cwd = await resolveWorkspaceRoot(req.workspaceProjectId);
  } catch {
    writer.send("run.error", {
      code: "project_not_found",
      message: `工作区 ${req.workspaceProjectId} 不存在`,
    });
    emitCanonicalRunFailed(writer, {
      runId,
      code: "project_not_found",
      message: `工作区 ${req.workspaceProjectId} 不存在`,
    });
    return;
  }

  const startedAtMs = Date.now();
  let assistantText = "";
  let compressedHistory = false;
  const canonicalEvents: CanonicalEvent[] = [];
  const canonicalArtifacts: CanonicalArtifact[] = [];
  const canonicalCitations: CanonicalCitation[] = [];
  let canonicalWorkspaceChanges: CanonicalWorkspaceChange[] = [];
  let latestStatusLabel: string | undefined;
  let waitingUserQuestion: string | undefined;

  const pushCanonicalEvent = (event: CanonicalEvent): void => {
    canonicalEvents.push(event);
  };

  const buildCanonicalOutputForRun = (
    outcome:
      | { status: "success" }
      | { status: "waiting_user"; message?: string }
      | { status: "cancelled"; message?: string }
      | { status: "failed"; code?: string; message: string },
    finalAnswer = assistantText,
  ) =>
    buildCanonicalOutput({
      sessionId: req.sessionId,
      turnId: canonicalTurnId(runId),
      runId,
      agentId: req.agentId,
      agentModel: req.agentModel,
      startedAt: startedAtMs,
      finishedAt: Date.now(),
      finalAnswer,
      outcome,
      canonicalEvents,
      artifacts: canonicalArtifacts,
      citations: canonicalCitations,
      workspaceChanges: canonicalWorkspaceChanges,
      latestStatus: latestStatusLabel,
      compressedHistory,
    });

  const emitCanonicalTerminalOutput = (
    outcome:
      | { status: "success" }
      | { status: "waiting_user"; message?: string }
      | { status: "cancelled"; message?: string }
      | { status: "failed"; code?: string; message: string },
    finalAnswer = assistantText,
  ) => {
    const canonicalOutput = buildCanonicalOutputForRun(outcome, finalAnswer);
    emitCanonicalOutput(writer, { runId, canonicalOutput });
    return canonicalOutput;
  };

  writer.send("run.accepted", {
    runId,
    sessionId: req.sessionId,
    agentId: req.agentId,
    message: "正在加载 Skill 与运行环境…",
  });
  emitRunStatus(writer, {
    runId,
    phase: "accepted",
    label: "正在加载 Skill 与运行环境…",
  });
  emitCanonicalRunAccepted(writer, {
    runId,
    message: "正在加载 Skill 与运行环境…",
  });
  pushCanonicalEvent({
    type: "run_accepted",
    runId,
    timestamp: Date.now(),
    message: "正在加载 Skill 与运行环境…",
  });

  const skillsRoot = resolveSkillsRoot();
  const promptsRoot = resolvePromptsRoot();

  let chatOrchestration: ChatOrchestration | null = null;
  if (req.moduleId === "chat") {
    const mode =
      normalizeChatMode(
        req.binding.moduleId === "chat" ? req.binding.mode : "fast",
      ) ?? "fast";
    chatOrchestration = resolveChatOrchestration({ mode, skillsRoot });
    if (!req.processSkill) {
      req.processSkill = chatOrchestration.baseProcessSkill;
    }
    if (!req.platformNormSkill) {
      req.platformNormSkill = chatOrchestration.platformNormSkill;
    }
  }

  const skillBundle = loadSkillBundle({
    skillsRoot,
    processSkill: req.processSkill,
    platformNormSkill: req.platformNormSkill,
  });
  const injectedSkills = [
    ...(skillBundle.platformNorm ? [skillBundle.platformNorm.slug] : []),
    ...(skillBundle.process ? [skillBundle.process.slug] : []),
  ];

  const agentKit =
    config.runMode === "cli"
      ? await stageAgentKitForRun({
          runId,
          processSkill: req.processSkill,
          skillsRoot,
        })
      : null;

  writer.send("run.started", {
    runId,
    agentId: req.agentId,
    cwd,
    processSkill: req.processSkill ?? null,
    baseProcessSkill:
      chatOrchestration?.baseProcessSkill ?? req.processSkill ?? null,
    platformNormSkill: req.platformNormSkill ?? null,
    orchestrationMode: chatOrchestration?.orchestrationMode ?? null,
    catalogVersion: chatOrchestration?.catalogVersion ?? null,
    catalogSlugs: chatOrchestration?.catalogSlugs ?? null,
    skillsRoot,
    promptsRoot,
    injectedSkills,
    missingSkills: skillBundle.missing,
    catalogMissingSlugs: chatOrchestration?.catalog.missingSlugs ?? null,
    agentKitPath: agentKit?.agentKitPath ?? null,
  });
  emitCanonicalRunStarted(writer, {
    runId,
    agentId: req.agentId,
    provider: req.agentId,
    model: req.agentModel,
  });
  pushCanonicalEvent({
    type: "run_started",
    runId,
    timestamp: Date.now(),
    provider: req.agentId,
    agentId: req.agentId,
    model: req.agentModel,
  });

  const lastUserIndex = findLastUserMessageIndex(req.messages);
  const lastUser = lastUserIndex >= 0 ? req.messages[lastUserIndex] : undefined;
  const userText = lastUser?.content ?? "";
  const mode: ChatModeId =
    req.binding.moduleId === "chat"
      ? (normalizeChatMode(req.binding.mode) ?? "fast")
      : "fast";

  try {
    if (config.runMode === "spawn") {
      writer.send("tool.progress", {
        tool: "phase",
        status: "running",
        message: `正在探测 ${req.agentId}… cwd=${cwd}`,
      });
      emitRunStatus(writer, {
        runId,
        phase: "running",
        label: `正在探测 ${req.agentId}… cwd=${cwd}`,
      });
      emitCanonicalToolProgress(writer, {
        runId,
        tool: "phase",
        status: "running",
        message: `正在探测 ${req.agentId}… cwd=${cwd}`,
      });
      const probe = await trySpawnVersionProbe(req.agentId, cwd, abort.signal);
      if (probe.ok) {
        const content = `> ${agent.bin} 已启动（版本探测）\n${probe.output.slice(0, 400)}\n\n`;
        writer.send("message.delta", { content });
        emitCanonicalAssistantDelta(writer, { runId, text: content });
      }
      await streamSimulatedReply(
        userText,
        mode,
        req.agentId,
        writer,
        abort,
        runId,
        {
          sessionId: req.sessionId,
          agentModel: req.agentModel,
        },
      );
      return;
    }

    if (config.runMode === "cli") {
      const runCtx = await loadSessionRunContext(req.sessionId);
      const scoped = applyTranscriptScope(
        req.messages as RunConversationMessage[],
        {
          workspaceProjectId: req.workspaceProjectId,
          previousWorkspaceProjectId: runCtx?.lastWorkspaceProjectId,
          agentId: req.agentId,
          previousAgentId: runCtx?.lastAgentId,
        },
      );

      if (scoped.workspaceChanged || scoped.agentChanged) {
        if (agentSpec.execution.supportsThreadResume) {
          await clearAgentThread(req.sessionId, req.agentId);
        }
        const reason = scoped.workspaceChanged
          ? "已切换工作区，仅携带本轮用户消息"
          : "已切换 Agent，已裁剪切换前的对话";
        writer.send("tool.progress", {
          tool: "phase",
          status: "running",
          message: reason,
        });
        emitRunStatus(writer, {
          runId,
          phase: "running",
          label: reason,
        });
        emitCanonicalToolProgress(writer, {
          runId,
          tool: "phase",
          status: "running",
          message: reason,
        });
      }

      let runMessages = scoped.messages;
      let compressPrep = prepareMessagesForRun(runMessages);
      if (compressPrep.compressed) {
        runMessages = compressPrep.messages;
        writer.send("tool.progress", {
          tool: "phase",
          status: "running",
          message: compressPrep.note ?? "正在压缩会话上下文…",
        });
        emitRunStatus(writer, {
          runId,
          phase: "running",
          label: compressPrep.note ?? "正在压缩会话上下文…",
        });
        emitCanonicalToolProgress(writer, {
          runId,
          tool: "phase",
          status: "running",
          message: compressPrep.note ?? "正在压缩会话上下文…",
        });
      }

      let composed = composeAgentRunPayload({
        mode,
        userText,
        messages: runMessages,
        processSkill: req.processSkill,
        platformNormSkill: req.platformNormSkill,
        agentKit,
        chatCatalog: chatOrchestration?.catalog ?? null,
        agentId: req.agentId,
        cwd,
      });

      if (exceedsHardPromptLimit(composed.composedPrompt)) {
        compressPrep = prepareMessagesForRun(scoped.messages, {
          composedPromptBytes: Buffer.byteLength(
            composed.composedPrompt,
            "utf8",
          ),
        });
        runMessages = compressPrep.messages;
        composed = composeAgentRunPayload({
          mode,
          userText,
          messages: runMessages,
          processSkill: req.processSkill,
          platformNormSkill: req.platformNormSkill,
          agentKit,
          chatCatalog: chatOrchestration?.catalog ?? null,
          agentId: req.agentId,
          cwd,
        });
        if (compressPrep.note) {
          writer.send("tool.progress", {
            tool: "phase",
            status: "running",
            message: compressPrep.note,
          });
          emitRunStatus(writer, {
            runId,
            phase: "running",
            label: compressPrep.note,
          });
          emitCanonicalToolProgress(writer, {
            runId,
            tool: "phase",
            status: "running",
            message: compressPrep.note,
          });
        }
      }

      if (exceedsHardPromptLimit(composed.composedPrompt)) {
        writer.send("run.error", {
          code: "prompt_too_large",
          message:
            "对话过长，自动压缩后仍超过安全上限。请新开对话后继续（完整记录仍在旧会话中）；后续版本将支持 Handoff 摘要迁移。",
        });
        emitCanonicalRunFailed(writer, {
          runId,
          code: "prompt_too_large",
          message:
            "对话过长，自动压缩后仍超过安全上限。请新开对话后继续（完整记录仍在旧会话中）；后续版本将支持 Handoff 摘要迁移。",
        });
        return;
      }

      const { composedPrompt, instructionPrompt, meta } = composed;

      const startLabel = taskStartLabel(userText, req.agentId);
      writer.send("tool.progress", {
        tool: "phase",
        status: "running",
        message: compressPrep.compressed
          ? `${compressPrep.note ?? "已压缩会话"} · ${startLabel}`
          : startLabel,
      });
      emitRunStatus(writer, {
        runId,
        phase: "running",
        label: compressPrep.compressed
          ? `${compressPrep.note ?? "已压缩会话"} · ${startLabel}`
          : startLabel,
      });
      emitCanonicalToolProgress(writer, {
        runId,
        tool: "phase",
        status: "running",
        message: compressPrep.compressed
          ? `${compressPrep.note ?? "已压缩会话"} · ${startLabel}`
          : startLabel,
      });

      void saveSessionRunContext(req.sessionId, {
        lastWorkspaceProjectId: req.workspaceProjectId,
        lastAgentId: req.agentId,
      });

      const beforeSnap = await snapshotWorkspace(cwd).catch(
        () => new Map<string, number>(),
      );
      const touchedPaths: string[] = [];
      let deliverablesEmitted = false;

      const emitWorkspaceDeliverables = async () => {
        if (deliverablesEmitted) return;
        const afterSnap = await snapshotWorkspace(cwd).catch(
          () => new Map<string, number>(),
        );
        const payload = buildDeliverablesFromDiff(
          beforeSnap,
          afterSnap,
          touchedPaths,
        );
        if (!payload || payload.items.length === 0) return;
        canonicalArtifacts.push(
          ...payload.items.map((item) => ({
            path: item.path,
            label: item.label,
            mime: item.mime,
            kind: item.kind,
          })),
        );
        canonicalWorkspaceChanges = payload.items.map((item) => ({
          path: item.path,
          kind: "modified" as const,
        }));
        const timestamp = Date.now();
        for (const item of payload.items) {
          pushCanonicalEvent({
            type: "artifact_found",
            runId,
            timestamp,
            path: item.path,
            label: item.label,
            mime: item.mime,
          });
          pushCanonicalEvent({
            type: "workspace_change",
            runId,
            timestamp,
            path: item.path,
            kind: "modified",
          });
          emitCanonicalWorkspaceChange(writer, {
            runId,
            path: item.path,
            kind: "modified",
            timestamp,
          });
        }
        emitDeliverablesPart(writer, payload);
        deliverablesEmitted = true;
      };

      let cliError: { code: string; message: string } | null = null;
      compressedHistory = compressPrep.compressed;

      const runCallbacks = {
        onText: (chunk: string) => {
          if (!chunk) return;
          assistantText += chunk;
          writer.send("message.delta", { content: chunk });
          emitCanonicalAssistantDelta(writer, { runId, text: chunk });
          pushCanonicalEvent({
            type: "assistant_delta",
            runId,
            timestamp: Date.now(),
            text: chunk,
          });
        },
        onNarration: (text: string) => {
          const trimmed = text.trim();
          if (!trimmed) return;
          writer.send("interim_assistant", {
            text: trimmed,
            already_streamed: false,
          });
          emitMessageInterim(writer, {
            runId,
            text: trimmed,
            alreadyStreamed: false,
          });
        },
        onUserInputRequest: (payload: {
          toolUseId: string;
          toolName: string;
          input: unknown;
          questions: Array<{
            id: string;
            question: string;
            header?: string;
            options?: Array<{ label: string; description?: string }>;
            multiSelect?: boolean;
          }>;
        }) => {
          pendingRunClarifications.set(runId, payload);
          const questionText = payload.questions
            .map((q, index) =>
              payload.questions.length > 1
                ? `${index + 1}. ${q.question}`
                : q.question,
            )
            .join("\n");
          waitingUserQuestion = questionText || "请补充信息后继续";
          latestStatusLabel = waitingUserQuestion;
          writer.send("clarification.required", {
            runId,
            clarificationId: payload.toolUseId,
            toolUseId: payload.toolUseId,
            toolName: payload.toolName,
            question: waitingUserQuestion,
            questions: payload.questions,
            input: payload.input,
          });
          writer.send("run.waiting_user", {
            runId,
            waitingFor: "clarification",
            question: waitingUserQuestion,
          });
          emitRunStatus(writer, {
            runId,
            phase: "waiting_user",
            label: waitingUserQuestion,
          });
          pushCanonicalEvent({
            type: "run_waiting_user",
            runId,
            timestamp: Date.now(),
            question: waitingUserQuestion,
          });
        },
        onToolProgress: (p: {
          tool: string;
          status?: string;
          message?: string;
          callId?: string;
          input?: unknown;
          output?: unknown;
        }) => {
          const path = extractPathFromToolMessage(p.tool, p.message);
          if (path) touchedPaths.push(path);
          writer.send("tool.progress", {
            tool: p.tool,
            status: p.status,
            message: p.message,
            callId: p.callId,
            input: p.input,
            output: p.output,
          });
          if (p.tool === "phase" && p.message) {
            latestStatusLabel = p.message;
            if (waitingUserLabel(p.message) && !waitingUserQuestion) {
              waitingUserQuestion = p.message;
              pushCanonicalEvent({
                type: "run_waiting_user",
                runId,
                timestamp: Date.now(),
                question: p.message,
              });
            }
            emitRunStatus(writer, {
              runId,
              phase: p.status ?? "running",
              label: p.message,
            });
          }
          emitCanonicalToolProgress(writer, {
            runId,
            tool: p.tool,
            status: p.status,
            message: p.message,
            callId: p.callId ?? (path ? `${p.tool}:${path}` : undefined),
            input: p.input,
            output: p.output,
          });
          const timestamp = Date.now();
          if (p.tool === "phase" && p.message) {
            pushCanonicalEvent({
              type: "status_changed",
              runId,
              timestamp,
              phase: p.status ?? "running",
              label: p.message,
            });
          } else if (p.status === "success" || p.status === "error" || p.status === "failed") {
            pushCanonicalEvent({
              type: "tool_finished",
              runId,
              timestamp,
              callId: p.callId ?? (path ? `${p.tool}:${path}` : `${p.tool}:${timestamp}`),
              tool: p.tool,
              status: p.status === "success" ? "success" : "error",
              message: p.message,
              output: p.output,
            });
          } else {
            pushCanonicalEvent({
              type: "tool_started",
              runId,
              timestamp,
              callId: p.callId ?? (path ? `${p.tool}:${path}` : `${p.tool}:${timestamp}`),
              tool: p.tool,
              message: p.message,
              input: p.input,
            });
          }
        },
        onError: (message: string, code?: string) => {
          cliError = { code: code ?? "cli_error", message };
        },
        onThreadStarted: (threadId: string) => {
          if (agentSpec.execution.supportsThreadResume) {
            void saveAgentThread(req.sessionId, req.agentId, cwd, threadId);
          }
        },
      };

      if (agentSpec.execution.prefersGateway && config.hermesGatewayPreferred) {
        const gatewayOk = await probeHermesGateway(config.hermesApiUrl);
        if (gatewayOk) {
          const sessionKey = buildHermesSessionKey(req.sessionId, req.agentId);
          const model =
            req.agentModel && req.agentModel !== "default"
              ? req.agentModel
              : config.hermesModel;
          const gatewayMessages: Array<{
            role: "system" | "user" | "assistant";
            content: string;
          }> = [
            { role: "system", content: instructionPrompt },
            ...req.messages
              .filter((m) => m.role === "user" || m.role === "assistant")
              .map((m) => ({
                role: m.role,
                content: m.content,
              })),
          ];
          const gwResult = await runHermesGateway(
            {
              baseUrl: config.hermesApiUrl,
              apiKey: config.hermesApiKey || undefined,
              model,
              sessionKey,
              messages: gatewayMessages,
            },
            runCallbacks,
            { signal: abort.signal },
          );

          if (abort.signal.aborted) {
            writer.send("run.cancelled", { runId });
            emitCanonicalRunCancelled(writer, { runId });
            return;
          }

          const gwFail =
            cliError ??
            (gwResult.exitCode !== 0 && gwResult.exitCode !== null
              ? {
                  code: "hermes_gateway_exit",
                  message:
                    gwResult.stderrTail ??
                    `Hermes Gateway 退出码 ${gwResult.exitCode}`,
                }
              : null) ??
            (gwResult.emptyOutput
              ? {
                  code: "empty_output",
                  message: "Hermes Gateway 未返回正文",
                }
              : null);

          if (!gwFail) {
            await emitWorkspaceDeliverables();
            emitCanonicalTerminalOutput(
              waitingUserQuestion
                ? { status: "waiting_user", message: waitingUserQuestion }
                : { status: "success" },
            );
            writer.send("run.finished", { runId });
            emitCanonicalRunFinished(writer, { runId });
            return;
          }

          const fallbackLabel = `${gwFail.message.slice(0, 120)}；回退 Hermes CLI…`;
          writer.send("tool.progress", {
            tool: "phase",
            status: "running",
            message: fallbackLabel,
          });
          emitRunStatus(writer, {
            runId,
            phase: "running",
            label: fallbackLabel,
          });
          emitCanonicalToolProgress(writer, {
            runId,
            tool: "phase",
            status: "running",
            message: fallbackLabel,
          });
          pushCanonicalEvent({
            type: "status_changed",
            runId,
            timestamp: Date.now(),
            phase: "running",
            label: fallbackLabel,
          });
        } else {
          const message =
            "Hermes Gateway 未就绪，回退 CLI（请启动 hermes gateway 或设置 HERMES_API_URL）";
          writer.send("tool.progress", {
            tool: "phase",
            status: "running",
            message,
          });
          emitRunStatus(writer, {
            runId,
            phase: "running",
            label: message,
          });
          emitCanonicalToolProgress(writer, {
            runId,
            tool: "phase",
            status: "running",
            message,
          });
          pushCanonicalEvent({
            type: "status_changed",
            runId,
            timestamp: Date.now(),
            phase: "running",
            label: message,
          });
        }
      }

      const result = await runAgent(
        {
          agentId: req.agentId,
          agentModel: req.agentModel,
          cwd,
          mode,
          composedPrompt,
          extraAllowedDirs: meta.agentKitPath ? [meta.agentKitPath] : undefined,
          processSkill: req.processSkill,
          platformNormSkill: req.platformNormSkill,
        },
        runCallbacks,
        {
          signal: abort.signal,
          onUserInputHandlerReady: (handler) => {
            activeRunUserInputHandlers.set(runId, handler);
          },
        },
      );

      if (abort.signal.aborted) {
        emitCanonicalTerminalOutput(
          { status: "cancelled", message: "Run cancelled" },
          assistantText.trim() ? `${assistantText.trim()}\n\n（已中断）` : "（已中断）",
        );
        writer.send("run.cancelled", { runId });
        emitCanonicalRunCancelled(writer, { runId });
        return;
      }

      const useSimulateFallback = config.cliFallback === "simulate";
      const hardFail =
        cliError ??
        (result.exitCode !== 0 && result.exitCode !== null
          ? {
              code: "cli_exit",
              message: formatCliFailureMessage(
                agent.bin,
                result,
                `${agent.bin} 退出异常`,
              ),
            }
          : null) ??
        (result.emptyOutput
          ? {
              code: "empty_output",
              message: formatCliFailureMessage(
                agent.bin,
                result,
                `${agent.bin} 未返回可解析的正文`,
              ),
            }
          : null);

      if (hardFail) {
        if (useSimulateFallback) {
          const message = `${hardFail.message}\n\n（已回退模拟输出，设置 COMPANION_CLI_FALLBACK=error 可关闭）`;
          writer.send("run.error", {
            code: hardFail.code,
            message,
          });
          emitCanonicalRunFailed(writer, {
            runId,
            code: hardFail.code,
            message,
          });
          await streamSimulatedReply(
            userText,
            mode,
            req.agentId,
            writer,
            abort,
            runId,
            {
              sessionId: req.sessionId,
              agentModel: req.agentModel,
            },
          );
        } else {
          emitCanonicalTerminalOutput({
            status: "failed",
            code: hardFail.code,
            message: hardFail.message,
          });
          writer.send("run.error", {
            code: hardFail.code,
            message: hardFail.message,
          });
          emitCanonicalRunFailed(writer, {
            runId,
            code: hardFail.code,
            message: hardFail.message,
          });
        }
        return;
      }

      if (agentSpec.execution.supportsThreadResume && result.codexThreadId) {
        await saveAgentThread(
          req.sessionId,
          req.agentId,
          cwd,
          result.codexThreadId,
        );
      }

      await emitWorkspaceDeliverables();
      emitCanonicalTerminalOutput(
        waitingUserQuestion
          ? { status: "waiting_user", message: waitingUserQuestion }
          : { status: "success" },
      );
      writer.send("run.finished", { runId });
      emitCanonicalRunFinished(writer, { runId });
      return;
    }

    await streamSimulatedReply(userText, mode, req.agentId, writer, abort, runId, {
      sessionId: req.sessionId,
      agentModel: req.agentModel,
    });
  } catch (err) {
    emitCanonicalTerminalOutput({
      status: "failed",
      code: "run_failed",
      message: err instanceof Error ? err.message : String(err),
    });
    writer.send("run.error", {
      code: "run_failed",
      message: err instanceof Error ? err.message : String(err),
    });
    emitCanonicalRunFailed(writer, {
      runId,
      code: "run_failed",
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    await writer.flush?.();
    writer.end();
    activeRuns.delete(runId);
    activeRunWriters.delete(runId);
    activeRunUserInputHandlers.delete(runId);
    pendingRunClarifications.delete(runId);
    activeRunRequests.delete(runId);
    if (activeSessionRuns.get(req.sessionId) === runId) {
      activeSessionRuns.delete(req.sessionId);
    }
    void import("./queue-runner.js").then((mod) =>
      mod.scheduleSessionQueueDrain(req.sessionId),
    );
  }
}

export async function executeRun(
  req: CreateRunRequest,
  res: ServerResponse,
): Promise<void> {
  const runId = `run-${randomUUID()}`;
  const baseWriter = createSseWriter(res, {
    "X-JLC-Run-Id": runId,
    "X-JLC-Agent-Id": req.agentId,
    "X-JLC-Execution-Mode": config.runMode,
  });
  const persistedWriter = createPersistedRunWriter(req, runId, baseWriter);
  const writer = createRuntimeStoreWriter(req, runId, persistedWriter);
  await executeRunLifecycle(req, writer, runId);
}

export async function startDetachedRun(
  req: CreateRunRequest,
  input?: { runId?: string },
): Promise<string> {
  const runId = input?.runId ?? `run-${randomUUID()}`;
  await primeRuntimeRunRecord(req, runId);

  void executeBackgroundRun(req, { runId }).catch(() => {
    // executeRunLifecycle persists terminal failures; this catch only prevents
    // an unhandled rejection if setup fails before the lifecycle writer exists.
  });

  return runId;
}

export async function executeBackgroundRun(
  req: CreateRunRequest,
  input?: { runId?: string },
): Promise<string> {
  const runId = input?.runId ?? `run-${randomUUID()}`;
  const persistedWriter = createPersistedRunWriter(
    req,
    runId,
    createNoopWriter(),
  );
  const writer = createRuntimeStoreWriter(req, runId, persistedWriter, {
    parentRunId: undefined,
  });
  await executeRunLifecycle(req, writer, runId);
  return runId;
}
