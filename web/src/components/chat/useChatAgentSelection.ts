"use client";

import { useCallback, useEffect, useState } from "react";
import { useSettings } from "@/components/settings/SettingsContext";
import type { ChatExecutionSource } from "@/lib/byok/shared";
import type { AgentId } from "@/lib/settings";
import {
  getLlmModels,
  resolveApiSelection,
} from "@/lib/byok/model-providers";

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

    // 从新的配置系统获取选中的 API 模型
    if (settings.executionSource === "api") {
      const apiModels = getLlmModels(settings.modelProviders);
      const activeApi = resolveApiSelection(
        settings.modelProviders,
        settings.activeApiSelection,
      );
      const activeModel = activeApi
        ? apiModels.find(
            (item) =>
              item.provider.id === activeApi.providerId &&
              item.model.id === activeApi.modelEntryId,
          )
        : apiModels[0];

      setAgentModel(activeModel?.model.modelId || "default");
    } else {
      setAgentModel(settings.agentModels[settings.defaultAgentId]);
    }
  }, [
    settings.modelProviders,
    settings.activeApiSelection,
    settings.defaultAgentId,
    settings.executionSource,
    settings.agentModels,
  ]);

  const selectAgentModel = useCallback(
    (source: ChatExecutionSource, id: AgentId, model: string) => {
      setExecutionSource(source);
      setAgentId(id);
      setAgentModel(model);
    },
    [],
  );

  return { executionSource, agentId, agentModel, selectAgentModel };
}
