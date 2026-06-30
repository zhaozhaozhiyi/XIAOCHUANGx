import type { ChatModeId } from "./chat-mode.js";
import type { CanonicalEvent, CanonicalTurnOutput } from "@jlc/contracts";

export const AGENT_IDS = [
  "codex",
  "claude",
  "hermes",
  "cursor-agent",
  "gemini",
  "opencode",
  "copilot",
  "qoder",
  "deepseek",
  "devin",
  "pi",
  "kiro",
  "kilo",
  "vibe",
  "openclaw",
] as const;

export type AgentId = (typeof AGENT_IDS)[number];

export type { ChatModeId, LegacyChatModeId } from "./chat-mode.js";

export type StreamFormat =
  | "codex-json"
  | "claude-jsonl"
  | "plain"
  | "json-event-stream"
  | "copilot-stream-json"
  | "qoder-stream-json"
  | "acp-json-rpc"
  | "pi-rpc";

export function isAgentId(value: string): value is AgentId {
  return (AGENT_IDS as readonly string[]).includes(value);
}

export type AgentStreamEvent =
  | { type: "text_delta"; delta: string }
  | {
      type: "user_input_request";
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
    }
  | {
      type: "tool_progress";
      tool: string;
      status?: string;
      message?: string;
      callId?: string;
      input?: unknown;
      output?: unknown;
    }
  | { type: "narration"; text: string }
  | { type: "error"; message: string; code?: string }
  | { type: "status"; label: string }
  | { type: "thread_started"; threadId: string };

export type {
  CanonicalEvent,
  CanonicalTurnOutput,
};

export type RunAgentInput = {
  agentId: AgentId;
  agentModel: string;
  cwd: string;
  mode: ChatModeId;
  /** OD 对齐：每轮完整 prompt（Instructions + transcript），经 stdin 投递 */
  composedPrompt: string;
  /** Agent Kit 等只读目录，传给 CLI `--add-dir` */
  extraAllowedDirs?: string[];
  processSkill?: string | null;
  platformNormSkill?: string;
};

export type RunAgentCallbacks = {
  onText: (chunk: string) => void;
  onUserInputRequest?: (payload: {
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
  }) => void;
  onToolProgress?: (payload: {
    tool: string;
    status?: string;
    message?: string;
    callId?: string;
    input?: unknown;
    output?: unknown;
  }) => void;
  onNarration?: (text: string) => void;
  onError?: (message: string, code?: string) => void;
  onThreadStarted?: (threadId: string) => void;
};

export type RunAgentUserInputResponse = {
  toolUseId: string;
  content: string;
  isError?: boolean;
};

export type RunAgentResult = {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  cancelled: boolean;
  /** CLI 有输出但解析器未提取到正文 */
  emptyOutput: boolean;
  /** 进程 stderr 尾部，供 Companion 写入 run.error */
  stderrTail?: string;
  /** 进程 stdout 尾部（解析失败时辅助排查） */
  stdoutTail?: string;
  codexThreadId?: string;
};
