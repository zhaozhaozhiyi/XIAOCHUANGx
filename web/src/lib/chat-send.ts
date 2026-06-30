import type { ChatSurfaceModuleId } from "@/lib/module-chat-config";
import type { ChatModeId } from "@/lib/navigation";
import type { ChatPendingAttachment } from "@/lib/chat";
import type { AgentId } from "@/lib/settings";
import type {
  ApiProviderConfig,
  ChatExecutionSource,
} from "@/lib/byok/shared";

/** 单次发送所需的会话与 Agent 上下文 */
export type ChatSendContext = {
  executionSource: ChatExecutionSource;
  mode: ChatModeId;
  surfaceModuleId?: ChatSurfaceModuleId;
  agentId: AgentId;
  agentModel: string;
  apiProvider?: ApiProviderConfig;
  /** UI 层项目绑定（none = 未绑定课题文件夹） */
  projectId: string;
  /** 写作模块 Skill 模板 ID */
  writingTemplateId?: string;
  /** PPT 模块 Skill 模板 ID */
  pptTemplateId?: string;
  attachments?: ChatPendingAttachment[];
};
