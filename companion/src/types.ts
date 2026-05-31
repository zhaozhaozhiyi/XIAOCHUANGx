/** 与 web/src/lib/companion/types.ts 保持同步（契约 v1） */

export const COMPANION_API_VERSION = "v1" as const;

import type { AgentId, ChatModeId } from "@jlc/runtime-core";
export type { AgentId, ChatModeId, LegacyChatModeId } from "@jlc/runtime-core";

export type ModuleId =
  | "chat"
  | "meeting"
  | "knowledge"
  | "writing"
  | "ppt";

export type WorkspaceKind = "sandbox" | "local_bound" | "cloud";

/** local_bound 绑定来源（PRD §5.3.2.2.1） */
export type LocalBoundSource = "user_picked" | "platform_default";

export type CliDetectStatus =
  | "available"
  | "not_installed"
  | "needs_login"
  | "outdated"
  | "timeout";

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
  /** 探测到的可执行路径（设置页 tooltip） */
  path?: string;
  models?: AgentModelOption[];
  modelsSource?: "live" | "fallback";
  capability?: AgentRuntimeCapability;
};

export type AgentTestRequest = {
  agentId: AgentId;
  model?: string;
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
  /** 仅 local_bound；platform_default = XIAOCHUANG 预授权目录 */
  bindingSource?: LocalBoundSource;
};

export type CreateRunBinding =
  | { moduleId: "chat"; mode: ChatModeId }
  | { moduleId: "writing"; templateId: string }
  | { moduleId: "ppt"; task: "deck" }
  | { moduleId: "meeting"; task: "summary"; templateId?: string }
  | { moduleId: "knowledge"; task: "kb-qa" };

export type ChatRunMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  attachments?: unknown[];
  agentId?: string;
};

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

export type FileTreeNode = {
  id: string;
  name: string;
  type: "file" | "folder";
  relativePath?: string;
  children?: FileTreeNode[];
};
