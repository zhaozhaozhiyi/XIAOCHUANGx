"use client";

import { useCallback, useState } from "react";
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
  const resolvedDefaultApiModel = (() => {
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
    return activeModel?.model.modelId || "default";
  })();
  const defaultExecutionSource = settings.executionSource;
  const defaultAgentId = settings.defaultAgentId;
  const defaultAgentModel =
    defaultExecutionSource === "api"
      ? resolvedDefaultApiModel
      : settings.agentModels[defaultAgentId];

  const [selection, setSelection] = useState<{
    executionSource: ChatExecutionSource;
    agentId: AgentId;
    agentModel: string;
  }>({
    executionSource: defaultExecutionSource,
    agentId: defaultAgentId,
    agentModel: defaultAgentModel,
  });

  const selectAgentModel = useCallback(
    (source: ChatExecutionSource, id: AgentId, model: string) => {
      setSelection({
        executionSource: source,
        agentId: id,
        agentModel: model,
      });
    },
    [],
  );

  return {
    executionSource: selection.executionSource,
    agentId: selection.agentId,
    agentModel: selection.agentModel,
    selectAgentModel,
  };
}
