import type { ChatModeId } from "@/lib/navigation";
import type { AgentId } from "@/lib/settings";
import type { ModuleId } from "@/lib/module-registry";
import type { RunEvent, RunRecord } from "@jlc/contracts";

/** Companion HTTP API 契约版本（与 PRD §8.5、web/docs/companion-api.md 一致） */
export const COMPANION_API_VERSION = "v1";

export type WorkspaceKind = "sandbox" | "local_bound" | "cloud";

export type CliDetectStatus =
  | "available"
  | "not_installed"
  | "needs_login"
  | "outdated";

export type CompanionHealthResponse = {
  ok: boolean;
  version: string;
  apiVersion: typeof COMPANION_API_VERSION;
  companionId?: string;
  dataDir?: string;
};

export type AgentModelOption = {
  id: string;
  label: string;
};

export type AgentRuntimeCapability = {
  supportsStreaming: boolean;
  supportsToolProgress: boolean;
  supportsNarration: boolean;
  supportsResumeThread: boolean;
  supportsInterrupt: boolean;
  supportsSteer: boolean;
  supportsCompanionRun?: boolean;
  inputMode: "stdin" | "argv" | "stdin_json" | "rpc";
  streamFormat:
    | "codex-json"
    | "claude-jsonl"
    | "plain"
    | "json-event-stream"
    | "copilot-stream-json"
    | "qoder-stream-json"
    | "acp-json-rpc"
    | "pi-rpc";
  transport?: "stdio" | "gateway" | "acp" | "pi_rpc";
  skillInjection?: "native" | "prompt" | "project_rules" | "mixed";
  prefersGateway?: boolean;
  unsupportedReason?: string;
};

export type CompanionAgentState = {
  agentId: AgentId;
  bin: string;
  status: CliDetectStatus;
  version: string | null;
  hint?: string;
  path?: string;
  models?: AgentModelOption[];
  modelsSource?: "live" | "fallback";
  capability?: AgentRuntimeCapability;
};

export type AgentTestResponse = {
  ok: boolean;
  agentId: AgentId;
  message: string;
};

export type CompanionAgentsResponse = {
  agents: CompanionAgentState[];
  defaultAgentId?: AgentId;
  inferenceChannel: "cli" | "api_fallback";
};

export type CompanionProjectSummary = {
  projectId: string;
  name: string;
  workspaceKind: WorkspaceKind;
  pathSummary: string;
  baseDir?: string;
};

export type CreateRunBinding =
  | { moduleId: "chat"; mode: ChatModeId }
  | { moduleId: "writing"; templateId: string }
  | { moduleId: "ppt"; task: "deck"; templateId?: string }
  | { moduleId: "meeting"; task: "summary" }
  | { moduleId: "knowledge"; task: "kb-qa" };

export type ChatRunMessage = {
  role: "user" | "assistant";
  content: string;
  agentId?: string;
};

/**
 * 创建 Agent 运行（对话主路径）。
 * `workspaceProjectId`：解析后的沙箱/本地绑定 ID（UI 的 none → sandbox-default）。
 */
export type CreateRunRequest = {
  sessionId: string;
  projectId: string;
  workspaceProjectId: string;
  moduleId: ModuleId;
  binding: CreateRunBinding;
  agentId: AgentId;
  agentModel: string;
  messages: ChatRunMessage[];
  useClientHistory?: boolean;
  processSkill?: string | null;
  platformNormSkill?: string;
};

export type CreateRunResponse = {
  runId: string;
  projectId: string;
  agentId: AgentId;
  cwd: string;
};

/** SSE event names from Companion */
export type CompanionSseEvent =
  | "run.accepted"
  | "run.status"
  | "run.started"
  | "canonical.event"
  | "message.delta"
  | "message.interim"
  | "interim_assistant"
  | "tool.progress"
  | "run.finished"
  | "run.error"
  | "run.cancelled";

export type InterimAssistantPayload = {
  text: string;
  already_streamed?: boolean;
};

export type MessageDeltaPayload = { content?: string };
export type ToolProgressPayload = {
  tool?: string;
  name?: string;
  status?: string;
  message?: string;
};
export type RunErrorPayload = { code?: string; message: string };

export type CompanionRunRecord = RunRecord;
export type CompanionRunEvent = RunEvent;

export type CompanionRunEventsResponse = {
  runId: string;
  items: CompanionRunEvent[];
  count: number;
};

export type CompanionSessionRunsResponse = {
  sessionId: string;
  items: CompanionRunRecord[];
  count: number;
};

export type CompanionQueuedRun = {
  id: string;
  runId: string;
  sessionId: string;
  action: "enqueue";
  text: string;
  attachments?: Array<{ fileId: string }>;
  createdAt: string;
};

export type CompanionSessionQueueResponse = {
  sessionId: string;
  items: CompanionQueuedRun[];
  count: number;
  running: boolean;
};
