import { createHash, randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
import {
  config,
  resolveRunIdleTimeoutMs,
  resolveRunTimeoutMs,
  type RunTimeoutProfile,
} from "../config.js";
import {
  createDefaultTaskProjectFromSource,
  resolveWorkspaceRoot,
} from "../projects/store.js";
import { clearAgentThread, saveAgentThread } from "../sessions/cli-threads.js";
import type { CreateRunRequest } from "../types.js";
import {
  type CanonicalArtifact,
  type CanonicalCitation,
  type CanonicalEvent,
  type CanonicalWorkspaceChange,
  type RunStatus,
} from "@jlc/contracts";
import {
  loadSessionRuntime,
  patchSessionRuntime,
  type SessionRuntimeRecord,
} from "../sessions/runtime.js";
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
import {
  buildRequirementSummaryPart,
  buildFallbackOutlinePart,
  buildRequirementsPart,
  extractRequirementSummaryPartFromAssistantMarkdown,
  extractRequirementsPartFromAssistantMarkdown,
  extractOutlinePartFromAssistantMarkdown,
} from "./requirements-parts.js";
import {
  ensureIndustrialDrawingFallback,
  ensureIndustrialDrawingPreviewFallback,
} from "./industrial-drawing-fallback.js";
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
    partId?: string;
    requirementsKind?:
      | "writing_requirements"
      | "ppt_requirements"
      | "3d_requirements"
      | "video_requirements";
    questions: Array<{
      id: string;
      question: string;
      header?: string;
      label?: string;
      type?:
        | "text"
        | "textarea"
        | "single_select"
        | "multi_select"
        | "date"
        | "time"
        | "datetime"
        | "number"
        | "file_pick"
        | "file_upload";
      required?: boolean;
      description?: string;
      placeholder?: string;
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
  const writer = activeRunWriters.get(runId);
  if (pending.partId) {
    writer?.send("part.patch", {
      id: pending.partId,
      merge: {
        submitted: true,
        answer: input.content,
        streaming: false,
        completedAt: Date.now(),
      },
    });
  }
  if (pending.requirementsKind) {
    writer?.send("part.append", {
      part: buildRequirementSummaryPart({
        requirementsKind: pending.requirementsKind,
        answer: input.content,
      }),
    });
  }
  pendingRunClarifications.delete(runId);
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

function buildStablePromptHash(instructionPrompt: string): string {
  return createHash("sha256")
    .update(instructionPrompt)
    .digest("hex")
    .slice(0, 16);
}

function isSubmittedRequirementFollowup(content: string): boolean {
  return content.trim().startsWith("我补充的信息如下，请继续完成刚才的任务：");
}

function buildPromptContextNotes(
  req: CreateRunRequest,
  input?: { userText?: string },
): string[] {
  const isRequirementFollowup = isSubmittedRequirementFollowup(
    input?.userText ?? "",
  );
  if (req.moduleId === "writing") {
    const templateId =
      "templateId" in req.binding && typeof req.binding.templateId === "string"
        ? req.binding.templateId.trim()
        : "";
    const notes = [
      "当前模块为写作，先完成需求采集与摘要确认，再进入大纲与正文。",
    ];
    if (templateId) {
      notes.push(
        `用户当前在前端选中的写作模板偏好是「${templateId}」；请在需求确认后据此优先选择或路由对应写作 Skill。`,
      );
    }
    if (isRequirementFollowup) {
      notes.push(
        "本轮是用户对写作需求表单/追问的补充回答，视为 brief 已确认：仍需输出 writing_requirement_summary；不要再次要求确认同一批信息；按任务复杂度继续输出 writing_outline 或直接生成 Markdown 交付物。",
      );
    }
    return notes;
  }

  if (req.moduleId === "ppt") {
    const templateId =
      "templateId" in req.binding && typeof req.binding.templateId === "string"
        ? req.binding.templateId.trim()
        : "";
    const notes = [
      "当前模块为 PPT，先完成需求采集与摘要确认，再进入页纲与产物生成。",
    ];
    if (templateId) {
      notes.push(
        `用户当前在前端选中的 PPT 模板偏好是「${templateId}」；请在需求确认后据此优先选择或路由对应 PPT Skill。`,
      );
    }
    if (isRequirementFollowup) {
      notes.push(
        "本轮是用户对 PPT 需求表单/追问的补充回答，视为 brief 已确认：必须输出 ppt_requirement_summary 和 ppt_outline，但不要再次要求用户确认摘要、页纲、公司名称或次级素材；对缺失素材使用默认假设或 [请补充] 占位，并继续生成 .html 预览，可行时同步生成 .pptx。",
      );
    }
    return notes;
  }

  if (req.moduleId === "3d") {
    const notes = [
      "当前模块为 3D / 工业制图，页面结构沿用写作和 PPT 的对话式工作流，但最终能力由工业制图 Skill 与工作区文件承载。",
      "当用户提出新建或修改工业结构、零件、支架、容器、管线、设备草模等需求时，应生成可继续编辑的参数化 CAD 文件，而不是只在聊天里解释方案。",
      req.lazyDefaultWorkspace
        ? "当前 cwd 是本轮 3D 任务的临时工作区根；请直接在根目录写入 `drawing.scad`、`drawing.parameters.json`、简短 `README.md`，导出物写入 `exports/`。平台会在检测到真实文件后再登记为正式工作区。"
        : "默认在当前工作区根目录写入 `drawing.scad`、`drawing.parameters.json` 和简短 `README.md`；若导出工具真实可用，再写入 `exports/drawing.stl`、`exports/drawing.dxf` 等文件。",
      "不要声称已生成 STL、DXF 或其他导出文件，除非对应文件已经真实写入工作区；如果 OpenSCAD CLI/WASM 不可用，仍应交付 `.scad` 与参数 JSON，并说明导出尚未执行。",
    ];
    if (isRequirementFollowup) {
      notes.push(
        "本轮是用户对 3D 制图需求表单/追问的补充回答，视为 brief 已确认：应输出 3d_requirement_summary 和 3d_outline，并继续生成 `.scad`、参数 JSON 与可预览 STL/OFF 产物。",
      );
    }
    return notes;
  }

  if (req.moduleId === "video") {
    const notes = [
      "当前模块为视频制作，页面结构沿用写作 / PPT 的对话式工作流；P0 目标是生成可预览、可录屏的 Web Video Presentation 网页视频项目。",
      req.lazyDefaultWorkspace
        ? "当前 cwd 是本轮视频任务的临时工作区根；请直接写入 `script.md`、`outline.md`，并用 `skills/skill-vp-web-video-presentation/scripts/scaffold.sh ./presentation` 生成 `presentation/`。平台会在检测到真实文件后再登记为正式工作区。"
        : "默认在当前工作区根目录写入 `script.md`、`outline.md` 和 `presentation/`；`presentation/` 必须可独立 `npm run dev`，预览入口为 `?reel=1`，录屏入口为 `?auto=1`。",
      "P0 不调用 Remotion，不承诺自动 MP4，不做 text-to-video；如果用户要求 MP4，说明当前交付为网页视频项目 + 录屏路径，自动 MP4 属于 P1。",
    ];
    if (isRequirementFollowup) {
      notes.push(
        "本轮是用户对视频需求表单/追问的补充回答，视为 brief 已确认：应输出 video_requirement_summary 和 video_outline，并继续生成 `script.md`、`outline.md` 与 `presentation/` 网页视频项目。",
      );
    }
    return notes;
  }

  if (req.moduleId === "simulation") {
    return [
      "当前模块为推演，页面结构沿用对话式工作流；目标是把复杂问题拆成主体、变量、假设、路径、触发条件和阶段性结论。",
      "推演不是一次性泛化回答：应先收敛推演边界，再给出结构化路径、关键变量和下一步可深挖方向。",
      "在专用推演画布协议完整接入前，优先输出清晰的推演方案、路径表和可落盘的推演报告草稿；不要声称已经生成交互画布，除非对应结构化产物已真实写入工作区。",
    ];
  }

  return [];
}

function resolveTimeoutProfile(req: CreateRunRequest): RunTimeoutProfile {
  if (req.timeoutProfile) return req.timeoutProfile;
  if (req.moduleId === "writing") return "writing";
  if (req.moduleId === "ppt") return "ppt";
  if (
    req.binding.moduleId === "chat" &&
    normalizeChatMode(req.binding.mode) === "deep"
  ) {
    return "deep";
  }
  if (
    req.binding.moduleId === "chat" &&
    normalizeChatMode(req.binding.mode) === "fast"
  ) {
    return "fast";
  }
  return "default";
}

function canonicalTurnId(runId: string): string {
  return `turn-${runId}`;
}

function requirementsKindForRun(input: {
  moduleId: string;
  processSkill?: string | null;
}):
  | "writing_requirements"
  | "ppt_requirements"
  | "3d_requirements"
  | "video_requirements"
  | null {
  if (
    input.moduleId === "writing" &&
    input.processSkill === "skill-writing-base"
  ) {
    return "writing_requirements";
  }
  if (input.moduleId === "ppt" && input.processSkill === "skill-ppt-base") {
    return "ppt_requirements";
  }
  if (
    input.moduleId === "3d" &&
    input.processSkill === "skill-industrial-drawing-base"
  ) {
    return "3d_requirements";
  }
  if (input.moduleId === "video" && input.processSkill === "skill-vp-base") {
    return "video_requirements";
  }
  return null;
}

function hasPreviewableCadArtifact(paths: Iterable<string>): boolean {
  for (const path of paths) {
    if (/\.(?:stl|off)$/i.test(path)) return true;
  }
  return false;
}

function cadSourcePaths(paths: Iterable<string>): string[] {
  const out: string[] = [];
  for (const path of paths) {
    if (/\.scad$/i.test(path)) out.push(path);
  }
  return out;
}

function shouldRunIndustrialDrawingFallback(input: {
  req: CreateRunRequest;
  assistantText: string;
  touchedPaths: string[];
}): boolean {
  if (input.req.moduleId !== "3d") return false;
  if (process.env.JLC_3D_FORCE_FALLBACK === "1") return true;
  if (input.touchedPaths.some((path) => /fallback_required/i.test(path))) {
    return true;
  }
  return /(?:fallback_required|需要兜底生成|预览兜底)/i.test(
    input.assistantText,
  );
}

function changedPathsSince(
  before: Map<string, number>,
  after: Map<string, number>,
): string[] {
  const changed: string[] = [];
  for (const [path, mtime] of after) {
    const prev = before.get(path);
    if (prev == null || mtime > prev) changed.push(path);
  }
  return changed;
}

function extractSubmittedRequirementAnswer(content: string): string | null {
  const marker = "我补充的信息如下，请继续完成刚才的任务：";
  const trimmed = content.trim();
  if (!trimmed.startsWith(marker)) return null;
  const answer = trimmed.slice(marker.length).trim();
  return answer || null;
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

  const persistEarlyFailure = async (
    message: string,
    patch?: Partial<SessionRuntimeRecord>,
  ) =>
    patchSessionRuntime(req.sessionId, {
      projectId: req.projectId,
      workspaceProjectId: req.workspaceProjectId,
      agentId: req.agentId,
      agentModel: req.agentModel,
      moduleId: req.moduleId,
      binding: req.binding,
      lastRunId: runId,
      lastRunStatus: "failed",
      lastStatusLabel: message,
      ...patch,
    });

  const agents = await detectAllAgents();
  const agent = findAgentState(agents.agents, req.agentId);
  const agentSpec = getAgentRegistryEntry(req.agentId);
  if (!agent || agent.status !== "available") {
    const message =
      agent?.hint ??
      `Agent ${req.agentId} 不可用（${agent?.status ?? "unknown"}）`;
    await persistEarlyFailure(message);
    writer.send("run.error", {
      code: "agent_unavailable",
      message,
    });
    emitCanonicalRunFailed(writer, {
      runId,
      code: "agent_unavailable",
      message,
    });
    return;
  }

  const priorRuntime = await loadSessionRuntime(req.sessionId);
  const isLazyDefaultWorkspace =
    req.moduleId === "3d" &&
    req.workspaceProjectId === "__lazy_default__" &&
    req.lazyDefaultWorkspace?.moduleId === "3d";

  let cwd: string;
  const reusedRuntimeCwd =
    !isLazyDefaultWorkspace &&
    priorRuntime?.workspaceProjectId === req.workspaceProjectId &&
    typeof priorRuntime.resolvedCwd === "string" &&
    priorRuntime.resolvedCwd.trim().length > 0;
  let lazyTempCwd: string | null = null;
  try {
    if (reusedRuntimeCwd) {
      cwd = priorRuntime.resolvedCwd!.trim();
    } else if (isLazyDefaultWorkspace) {
      cwd = await mkdtemp(join(tmpdir(), "jlc-3d-lazy-"));
      lazyTempCwd = cwd;
    } else {
      cwd = await resolveWorkspaceRoot(req.workspaceProjectId);
    }
  } catch {
    const message = `工作区 ${req.workspaceProjectId} 不存在`;
    await persistEarlyFailure(message);
    writer.send("run.error", {
      code: "project_not_found",
      message,
    });
    emitCanonicalRunFailed(writer, {
      runId,
      code: "project_not_found",
      message,
    });
    return;
  }
  const resolvedCwdSource = reusedRuntimeCwd
    ? ("session_runtime" as const)
    : isLazyDefaultWorkspace
      ? ("lazy_default_workspace" as const)
    : ("workspace_project" as const);
  const timeoutProfile = resolveTimeoutProfile(req);
  const timeoutMs = resolveRunTimeoutMs(timeoutProfile, req.timeoutMs);
  const idleTimeoutMs = Math.min(
    resolveRunIdleTimeoutMs(req.idleTimeoutMs),
    timeoutMs,
  );

  const startedAtMs = Date.now();
  let assistantText = "";
  let compressedHistory = false;
  const canonicalEvents: CanonicalEvent[] = [];
  const canonicalArtifacts: CanonicalArtifact[] = [];
  const canonicalCitations: CanonicalCitation[] = [];
  let canonicalWorkspaceChanges: CanonicalWorkspaceChange[] = [];
  let latestStatusLabel: string | undefined;
  let waitingUserQuestion: string | undefined;
  let requirementsCardEmitted = false;
  let requirementSummaryEmitted = false;
  let outlinePartEmitted = false;
  const emittedPartKinds = new Set<string>();

  const pushCanonicalEvent = (event: CanonicalEvent): void => {
    canonicalEvents.push(event);
  };

  const appendPartOnce = (part: { kind?: unknown }): boolean => {
    const kind = typeof part.kind === "string" ? part.kind : "";
    if (kind && emittedPartKinds.has(kind)) return false;
    if (kind) emittedPartKinds.add(kind);
    writer.send("part.append", {
      part,
    });
    return true;
  };

  const emitStructuredAssistantParts = (): void => {
    if (!requirementsCardEmitted && !requirementFollowup) {
      const requirementsPart = extractRequirementsPartFromAssistantMarkdown({
        moduleId: req.moduleId,
        processSkill: req.processSkill,
        assistantMarkdown: assistantText,
      });
      if (requirementsPart) {
        requirementsCardEmitted = true;
        waitingUserQuestion = requirementsPart.title;
        latestStatusLabel = requirementsPart.title;
        appendPartOnce(requirementsPart);
        writer.send("run.waiting_user", {
          runId,
          waitingFor: "clarification",
          question: requirementsPart.title,
        });
        emitRunStatus(writer, {
          runId,
          phase: "waiting_user",
          label: requirementsPart.title,
        });
      }
    }

    const extractedOutline =
      outlinePartEmitted
        ? null
        : extractOutlinePartFromAssistantMarkdown({
            assistantMarkdown: assistantText,
          });
    if (extractedOutline) {
      outlinePartEmitted = true;
      assistantText = extractedOutline.cleanedMarkdown;
    }

    const extractedSummary =
      requirementSummaryEmitted
        ? null
        : extractRequirementSummaryPartFromAssistantMarkdown({
            moduleId: req.moduleId,
            processSkill: req.processSkill,
            assistantMarkdown: assistantText,
          });
    if (extractedSummary) {
      requirementSummaryEmitted = true;
      assistantText = extractedSummary.cleanedMarkdown;
      appendPartOnce(extractedSummary.part);
    }

    if (extractedOutline) {
      appendPartOnce(extractedOutline.part);
    }
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

  const persistRuntimeStatus = async (
    status: RunStatus,
    patch?: Partial<SessionRuntimeRecord>,
  ) =>
    patchSessionRuntime(req.sessionId, {
      projectId: req.projectId,
      workspaceProjectId: req.workspaceProjectId,
      resolvedCwd: cwd,
      resolvedCwdSource,
      agentId: req.agentId,
      agentModel: req.agentModel,
      moduleId: req.moduleId,
      binding: req.binding,
      timeoutProfile,
      timeoutMs,
      idleTimeoutMs,
      lastRunId: runId,
      lastRunStatus: status,
      ...patch,
    });

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
  await persistRuntimeStatus("accepted", {
    lastStatusLabel: "正在加载 Skill 与运行环境…",
  });

  const skillsRoot = resolveSkillsRoot();
  const promptsRoot = resolvePromptsRoot();

  let chatOrchestration: ChatOrchestration | null = null;
  if (req.moduleId === "chat") {
    const mode =
      normalizeChatMode(
        req.binding.moduleId === "chat" ? req.binding.mode : "auto",
      ) ?? "auto";
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

  const emitRunStartedEvent = (input?: {
    stablePromptHash?: string;
  }) => {
    writer.send("run.started", {
      runId,
      agentId: req.agentId,
      cwd,
      cwdSource: resolvedCwdSource,
      processSkill: req.processSkill ?? null,
      baseProcessSkill:
        chatOrchestration?.baseProcessSkill ?? req.processSkill ?? null,
      platformNormSkill: req.platformNormSkill ?? null,
      orchestrationMode: chatOrchestration?.orchestrationMode ?? null,
      catalogVersion: chatOrchestration?.catalogVersion ?? null,
      catalogSlugs: chatOrchestration?.catalogSlugs ?? null,
      injectedSkills,
      missingSkills: skillBundle.missing,
      catalogMissingSlugs: chatOrchestration?.catalog.missingSlugs ?? null,
      skillsRoot,
      promptsRoot,
      agentKitPath: agentKit?.agentKitPath ?? null,
      timeoutProfile,
      timeoutMs,
      idleTimeoutMs,
      stablePromptHash: input?.stablePromptHash,
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
  };

  const lastUserIndex = findLastUserMessageIndex(req.messages);
  const lastUser = lastUserIndex >= 0 ? req.messages[lastUserIndex] : undefined;
  const userText = lastUser?.content ?? "";
  const requirementFollowup = isSubmittedRequirementFollowup(userText);
  const mode: ChatModeId =
    req.binding.moduleId === "chat"
      ? (normalizeChatMode(req.binding.mode) ?? "auto")
      : "fast";

  try {
    if (config.runMode === "spawn") {
      await persistRuntimeStatus("running", {
        processSkill: req.processSkill ?? null,
        platformNormSkill: req.platformNormSkill ?? null,
        injectedSkills,
        orchestrationMode: chatOrchestration?.orchestrationMode ?? null,
        catalogVersion: chatOrchestration?.catalogVersion ?? null,
        catalogSlugs: chatOrchestration?.catalogSlugs ?? null,
        skillsRoot,
        promptsRoot,
        agentKitPath: agentKit?.agentKitPath ?? null,
      });
      emitRunStartedEvent();
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
      await persistRuntimeStatus(
        abort.signal.aborted ? "cancelled" : "completed",
        {
          lastStatusLabel: abort.signal.aborted
            ? "Run cancelled"
            : "Mock run completed",
        },
      );
      return;
    }

    if (config.runMode === "cli") {
      const scoped = applyTranscriptScope(
        req.messages as RunConversationMessage[],
        {
          workspaceProjectId: req.workspaceProjectId,
          previousWorkspaceProjectId: priorRuntime?.workspaceProjectId,
          agentId: req.agentId,
          previousAgentId: priorRuntime?.agentId,
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
        contextNotes: buildPromptContextNotes(req, { userText }),
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
          contextNotes: buildPromptContextNotes(req, { userText }),
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
        await persistRuntimeStatus("failed", {
          lastStatusLabel:
            "对话过长，自动压缩后仍超过安全上限。请新开对话后继续。",
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
      const stablePromptHash = buildStablePromptHash(instructionPrompt);
      await persistRuntimeStatus("running", {
        processSkill: req.processSkill ?? null,
        platformNormSkill: req.platformNormSkill ?? null,
        injectedSkills,
        orchestrationMode: chatOrchestration?.orchestrationMode ?? null,
        catalogVersion: chatOrchestration?.catalogVersion ?? null,
        catalogSlugs: chatOrchestration?.catalogSlugs ?? null,
        stablePromptHash,
        skillsRoot,
        promptsRoot,
        agentKitPath: meta.agentKitPath,
      });
      emitRunStartedEvent({ stablePromptHash });

      const submittedRequirementAnswer =
        extractSubmittedRequirementAnswer(userText);
      const submittedRequirementKind = submittedRequirementAnswer
        ? requirementsKindForRun(req)
        : null;
      if (submittedRequirementAnswer && submittedRequirementKind) {
        writer.send("part.append", {
          part: buildRequirementSummaryPart({
            requirementsKind: submittedRequirementKind,
            answer: submittedRequirementAnswer,
          }),
        });
        requirementSummaryEmitted = true;
        if (
          req.moduleId === "writing" &&
          /年度|报告|研究|专题|深度/.test(submittedRequirementAnswer)
        ) {
          writer.send("part.append", {
            part: buildFallbackOutlinePart({
              kind: "writing_outline",
              briefText: submittedRequirementAnswer,
            }),
          });
          outlinePartEmitted = true;
        }
        if (req.moduleId === "ppt") {
          writer.send("part.append", {
            part: buildFallbackOutlinePart({
              kind: "ppt_outline",
              briefText: submittedRequirementAnswer,
            }),
          });
          outlinePartEmitted = true;
        }
        if (req.moduleId === "3d") {
          writer.send("part.append", {
            part: buildFallbackOutlinePart({
              kind: "3d_outline",
              briefText: submittedRequirementAnswer,
            }),
          });
          outlinePartEmitted = true;
        }
        if (req.moduleId === "video") {
          writer.send("part.append", {
            part: buildFallbackOutlinePart({
              kind: "video_outline",
              briefText: submittedRequirementAnswer,
            }),
          });
          outlinePartEmitted = true;
        }
      }

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
      void persistRuntimeStatus("running", {
        lastStatusLabel: compressPrep.compressed
          ? `${compressPrep.note ?? "已压缩会话"} · ${startLabel}`
          : startLabel,
      });

      let beforeSnap = await snapshotWorkspace(cwd).catch(
        () => new Map<string, number>(),
      );
      const touchedPaths: string[] = [];
      let deliverablesEmitted = false;
      let materializedLazyProject = false;

      const emitWorkspaceDeliverables = async () => {
        if (deliverablesEmitted) return;
        let afterSnap = await snapshotWorkspace(cwd).catch(
          () => new Map<string, number>(),
        );
        const changedPaths = changedPathsSince(beforeSnap, afterSnap);
        const hasPreview =
          hasPreviewableCadArtifact(changedPaths) ||
          hasPreviewableCadArtifact(touchedPaths);
        const sourcePaths = cadSourcePaths([
          ...changedPaths,
          ...touchedPaths,
        ]);
        if (
          req.moduleId === "3d" &&
          !waitingUserQuestion &&
          !hasPreview &&
          sourcePaths.length > 0
        ) {
          try {
            const previewFallback =
              await ensureIndustrialDrawingPreviewFallback({
                cwd,
                cadSourcePaths: sourcePaths,
              });
            if (previewFallback) {
              touchedPaths.push(...previewFallback.relativePaths);
              afterSnap = await snapshotWorkspace(cwd).catch(
                () => new Map<string, number>(),
              );
              emitCanonicalToolProgress(writer, {
                runId,
                tool: "industrial_drawing_preview_fallback",
                status: "success",
                message: "已基于真实 SCAD 产物生成工作区预览 STL",
                output: {
                  source: previewFallback.sourceScadPath,
                  paths: previewFallback.relativePaths,
                },
              });
              pushCanonicalEvent({
                type: "tool_finished",
                runId,
                timestamp: Date.now(),
                callId: `industrial_drawing_preview_fallback:${Date.now()}`,
                tool: "industrial_drawing_preview_fallback",
                status: "success",
                message: "已基于真实 SCAD 产物生成工作区预览 STL",
                output: {
                  source: previewFallback.sourceScadPath,
                  paths: previewFallback.relativePaths,
                },
              });
            }
          } catch (err) {
            const message =
              err instanceof Error
                ? err.message
                : "preview fallback generation failed";
            emitCanonicalToolProgress(writer, {
              runId,
              tool: "industrial_drawing_preview_fallback",
              status: "error",
              message,
            });
          }
        }
        if (
          req.moduleId === "3d" &&
          !waitingUserQuestion &&
          shouldRunIndustrialDrawingFallback({
            req,
            assistantText,
            touchedPaths,
          }) &&
          cadSourcePaths(changedPathsSince(beforeSnap, afterSnap)).length === 0 &&
          cadSourcePaths(touchedPaths).length === 0 &&
          !hasPreviewableCadArtifact(changedPathsSince(beforeSnap, afterSnap)) &&
          !hasPreviewableCadArtifact(touchedPaths)
        ) {
          try {
            const fallback = await ensureIndustrialDrawingFallback({
              cwd,
              userText,
            });
            touchedPaths.push(...fallback.relativePaths);
            afterSnap = await snapshotWorkspace(cwd).catch(
              () => new Map<string, number>(),
            );
            emitCanonicalToolProgress(writer, {
              runId,
              tool: "industrial_drawing_fallback",
              status: "success",
              message: "已生成工业制图预览草模",
              output: { paths: fallback.relativePaths },
            });
            pushCanonicalEvent({
              type: "tool_finished",
              runId,
              timestamp: Date.now(),
              callId: `industrial_drawing_fallback:${Date.now()}`,
              tool: "industrial_drawing_fallback",
              status: "success",
              message: "已生成工业制图预览草模",
              output: { paths: fallback.relativePaths },
            });
          } catch (err) {
            const message =
              err instanceof Error ? err.message : "fallback generation failed";
            emitCanonicalToolProgress(writer, {
              runId,
              tool: "industrial_drawing_fallback",
              status: "error",
              message,
            });
          }
        }
        const payload = buildDeliverablesFromDiff(
          beforeSnap,
          afterSnap,
          touchedPaths,
        );
        if (!payload || payload.items.length === 0) return;
        if (isLazyDefaultWorkspace && !materializedLazyProject) {
          const project = await createDefaultTaskProjectFromSource({
            moduleId: "3d",
            taskId: req.lazyDefaultWorkspace?.taskId ?? req.sessionId,
            taskTitle: req.lazyDefaultWorkspace?.taskTitle ?? userText.slice(0, 48),
            sourceDir: cwd,
          });
          materializedLazyProject = true;
          req.projectId = project.projectId;
          req.workspaceProjectId = project.projectId;
          cwd = await resolveWorkspaceRoot(project.projectId);
          beforeSnap = new Map<string, number>();
          afterSnap = await snapshotWorkspace(cwd).catch(
            () => new Map<string, number>(),
          );
          touchedPaths.splice(0, touchedPaths.length);
          writer.send("project.ensured", {
            id: project.projectId,
            name: project.name,
            pathSummary: project.pathSummary,
          });
          await persistRuntimeStatus("running", {
            projectId: project.projectId,
            workspaceProjectId: project.projectId,
            resolvedCwd: cwd,
            resolvedCwdSource: "workspace_project",
            lastStatusLabel: latestStatusLabel,
          });
        }
        const finalPayload = buildDeliverablesFromDiff(
          beforeSnap,
          afterSnap,
          touchedPaths,
        );
        if (!finalPayload || finalPayload.items.length === 0) return;
        canonicalArtifacts.push(
          ...finalPayload.items.map((item) => ({
            path: item.path,
            label: item.label,
            mime: item.mime,
            kind:
              item.path === finalPayload.primaryPath
                ? ("primary" as const)
                : ("attachment" as const),
          })),
        );
        canonicalWorkspaceChanges = finalPayload.items.map((item) => ({
          path: item.path,
          kind: "modified" as const,
        }));
        const timestamp = Date.now();
        for (const item of finalPayload.items) {
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
        emitDeliverablesPart(writer, finalPayload);
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
            label?: string;
            type?:
              | "text"
              | "textarea"
              | "single_select"
              | "multi_select"
              | "date"
              | "time"
              | "datetime"
              | "number"
              | "file_pick"
              | "file_upload";
            required?: boolean;
            description?: string;
            placeholder?: string;
            options?: Array<{ label: string; description?: string }>;
            multiSelect?: boolean;
          }>;
        }) => {
          const requirementsPart = buildRequirementsPart({
            runId,
            toolUseId: payload.toolUseId,
            moduleId: req.moduleId,
            processSkill: req.processSkill,
            rawInput: payload.input,
            questions: payload.questions,
          });
          pendingRunClarifications.set(runId, {
            ...payload,
            partId: requirementsPart?.id,
            requirementsKind:
              requirementsPart?.kind === "writing_requirements" ||
              requirementsPart?.kind === "ppt_requirements" ||
              requirementsPart?.kind === "3d_requirements" ||
              requirementsPart?.kind === "video_requirements"
                ? requirementsPart.kind
                : undefined,
          });
          requirementsCardEmitted = Boolean(requirementsPart);
          const questionText = payload.questions
            .map((q, index) =>
              payload.questions.length > 1
                ? `${index + 1}. ${q.question}`
                : q.question,
            )
            .join("\n");
          waitingUserQuestion =
            requirementsPart?.title || questionText || "请补充信息后继续";
          latestStatusLabel = waitingUserQuestion;
          if (requirementsPart) {
            writer.send("part.append", {
              part: requirementsPart,
            });
          } else {
            writer.send("clarification.required", {
              runId,
              clarificationId: payload.toolUseId,
              toolUseId: payload.toolUseId,
              toolName: payload.toolName,
              question: waitingUserQuestion,
              questions: payload.questions,
              input: payload.input,
            });
          }
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
          void persistRuntimeStatus("waiting_user", {
            lastStatusLabel: waitingUserQuestion,
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
            void persistRuntimeStatus(
              waitingUserLabel(p.message) ? "waiting_user" : "running",
              {
                lastStatusLabel: p.message,
              },
            );
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
            emitCanonicalTerminalOutput(
              { status: "cancelled", message: "Run cancelled" },
              assistantText.trim()
                ? `${assistantText.trim()}\n\n（已中断）`
                : "（已中断）",
            );
            await persistRuntimeStatus("cancelled", {
              lastStatusLabel: "Run cancelled",
            });
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
            emitStructuredAssistantParts();
            await emitWorkspaceDeliverables();
            emitCanonicalTerminalOutput(
              waitingUserQuestion
                ? { status: "waiting_user", message: waitingUserQuestion }
                : { status: "success" },
            );
            await persistRuntimeStatus(
              waitingUserQuestion ? "waiting_user" : "completed",
              { lastStatusLabel: waitingUserQuestion ?? latestStatusLabel },
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
          timeoutMs,
          idleTimeoutMs,
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
        await persistRuntimeStatus("cancelled", {
          lastStatusLabel: "Run cancelled",
        });
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
          await persistRuntimeStatus(
            abort.signal.aborted ? "cancelled" : "completed",
            {
              lastStatusLabel: abort.signal.aborted
                ? "Run cancelled"
                : "已回退模拟输出",
            },
          );
        } else {
          emitCanonicalTerminalOutput({
            status: "failed",
            code: hardFail.code,
            message: hardFail.message,
          });
          await persistRuntimeStatus("failed", {
            lastStatusLabel: hardFail.message,
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

      emitStructuredAssistantParts();
      await emitWorkspaceDeliverables();
      emitCanonicalTerminalOutput(
        waitingUserQuestion
          ? { status: "waiting_user", message: waitingUserQuestion }
          : { status: "success" },
      );
      await persistRuntimeStatus(
        waitingUserQuestion ? "waiting_user" : "completed",
        { lastStatusLabel: waitingUserQuestion ?? latestStatusLabel },
      );
      writer.send("run.finished", { runId });
      emitCanonicalRunFinished(writer, { runId });
      return;
    }

    await persistRuntimeStatus("running", {
      processSkill: req.processSkill ?? null,
      platformNormSkill: req.platformNormSkill ?? null,
      injectedSkills,
      orchestrationMode: chatOrchestration?.orchestrationMode ?? null,
      catalogVersion: chatOrchestration?.catalogVersion ?? null,
      catalogSlugs: chatOrchestration?.catalogSlugs ?? null,
      skillsRoot,
      promptsRoot,
      agentKitPath: agentKit?.agentKitPath ?? null,
    });
    emitRunStartedEvent();
    await streamSimulatedReply(userText, mode, req.agentId, writer, abort, runId, {
      sessionId: req.sessionId,
      agentModel: req.agentModel,
    });
    await persistRuntimeStatus(
      abort.signal.aborted ? "cancelled" : "completed",
      {
        lastStatusLabel: abort.signal.aborted
          ? "Run cancelled"
          : "Simulated run completed",
      },
    );
  } catch (err) {
    emitCanonicalTerminalOutput({
      status: "failed",
      code: "run_failed",
      message: err instanceof Error ? err.message : String(err),
    });
    await persistRuntimeStatus("failed", {
      lastStatusLabel: err instanceof Error ? err.message : String(err),
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
    if (lazyTempCwd) {
      await rm(lazyTempCwd, { recursive: true, force: true }).catch(() => {});
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
