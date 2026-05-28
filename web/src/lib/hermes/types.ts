import type { ChatModeId } from "@/lib/navigation";
import type { AgentId } from "@/lib/settings";
import type {
  ApiProviderConfig,
  ChatExecutionSource,
} from "@/lib/byok/shared";

export type HermesChatRole = "user" | "assistant";

export type HermesHistoryMessage = {
  id?: string;
  role: HermesChatRole;
  content: string;
  attachments?: unknown[];
  agentId?: string;
};

export type ChatCompletionRequestBody = {
  sessionId: string;
  mode: ChatModeId;
  executionSource?: ChatExecutionSource;
  agentId: AgentId;
  agentModel: string;
  apiProvider?: ApiProviderConfig;
  messages: HermesHistoryMessage[];
  /** UI 项目绑定；`none` 时 BFF 解析为沙箱 projectId（Companion 路径必填） */
  projectId?: string;
  /** Use request-body history (e.g. mid-stream steer); skip gateway session DB override. */
  useClientHistory?: boolean;
};

export type OpenAIChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
