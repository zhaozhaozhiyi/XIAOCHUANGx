import type { ChatModeId } from "@/lib/navigation";
import { getAgentSystemSuffix } from "@/lib/hermes/agent";
import { getModeSystemPrompt } from "@/lib/hermes/modes";
import type { AgentId } from "@/lib/settings";
import type { HermesHistoryMessage, OpenAIChatMessage } from "@/lib/hermes/types";

export function buildChatCompletionMessages(
  history: HermesHistoryMessage[],
  mode: ChatModeId,
  agentId: AgentId,
  agentModel: string,
): OpenAIChatMessage[] {
  const trimmed = history.filter(
    (m) => m.content.trim().length > 0 && (m.role === "user" || m.role === "assistant"),
  );

  const system =
    getModeSystemPrompt(mode) + getAgentSystemSuffix(agentId, agentModel);

  return [
    { role: "system", content: system },
    ...trimmed.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content.trim(),
    })),
  ];
}
