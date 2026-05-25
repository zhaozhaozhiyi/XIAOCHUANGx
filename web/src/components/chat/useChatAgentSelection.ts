"use client";

import { useCallback, useEffect, useState } from "react";
import { useSettings } from "@/components/settings/SettingsContext";
import type { ChatExecutionSource } from "@/lib/byok/shared";
import type { AgentId } from "@/lib/settings";

/** 对话页顶栏 Agent / 模型档位，与设置默认值同步 */
export function useChatAgentSelection() {
  const { settings } = useSettings();
  const [executionSource, setExecutionSource] = useState<ChatExecutionSource>(
    settings.executionSource,
  );
  const [agentId, setAgentId] = useState<AgentId>(settings.defaultAgentId);
  const [agentModel, setAgentModel] = useState(
    settings.agentModels[settings.defaultAgentId],
  );

  useEffect(() => {
    setExecutionSource(settings.executionSource);
    setAgentId(settings.defaultAgentId);
    setAgentModel(
      settings.executionSource === "api"
        ? settings.apiProvider.model || "default"
        : settings.agentModels[settings.defaultAgentId],
    );
  }, [
    settings.apiProvider.model,
    settings.defaultAgentId,
    settings.executionSource,
    settings.agentModels,
  ]);

  const selectAgentModel = useCallback((
    source: ChatExecutionSource,
    id: AgentId,
    model: string,
  ) => {
    setExecutionSource(source);
    setAgentId(id);
    setAgentModel(model);
  }, []);

  return { executionSource, agentId, agentModel, selectAgentModel };
}
