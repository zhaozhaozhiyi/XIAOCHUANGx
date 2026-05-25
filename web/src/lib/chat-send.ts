import type { ChatModeId } from "@/lib/navigation";
import type { AgentId } from "@/lib/settings";
import type {
  ApiProviderConfig,
  ChatExecutionSource,
} from "@/lib/byok/shared";

/** 单次发送所需的会话与 Agent 上下文 */
export type ChatSendContext = {
  executionSource: ChatExecutionSource;
  mode: ChatModeId;
  agentId: AgentId;
  agentModel: string;
  apiProvider?: ApiProviderConfig;
  /** UI 层项目绑定（none = 无项目） */
  projectId: string;
};
