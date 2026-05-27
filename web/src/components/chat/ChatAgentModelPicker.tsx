"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { HermesStatusDot } from "@/components/chat/HermesStatusBadge";
import { useSettings } from "@/components/settings/SettingsContext";
import {
  getLlmModels,
  hasAnyUsableProvider,
  resolveApiSelection,
} from "@/lib/byok/model-providers";
import {
  hasUsableApiProviderConfig,
  providerDisplayName,
  type ChatExecutionSource,
} from "@/lib/byok/shared";
import {
  cliStatusHintRuntime,
  getAgentRuntimeState,
  getAvailableAgentsRuntime,
  isAgentAvailableRuntime,
  modelOptionsForAgent,
  resolveSelectableAgentIdRuntime,
} from "@/lib/agents-runtime";
import { AGENT_DEFINITIONS, type AgentId } from "@/lib/settings";

function agentShortName(name: string): string {
  return name.replace(" CLI", "");
}

type ChatAgentModelPickerProps = {
  executionSource: ChatExecutionSource;
  agentId: AgentId;
  agentModel: string;
  onChange: (
    source: ChatExecutionSource,
    agentId: AgentId,
    modelId: string,
  ) => void;
};

/** 顶栏：统一执行源选择器（CLI / API）+ 模型档位 */
export function ChatAgentModelPicker({
  executionSource,
  agentId,
  agentModel,
  onChange,
}: ChatAgentModelPickerProps) {
  const { settings, agentsRuntime, updateSettings } = useSettings();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const apiModels = useMemo(
    () => getLlmModels(settings.modelProviders),
    [settings.modelProviders],
  );
  const apiEnabled =
    hasAnyUsableProvider(settings.modelProviders) ||
    hasUsableApiProviderConfig(settings.apiProvider);

  const activeApi = resolveApiSelection(
    settings.modelProviders,
    settings.activeApiSelection,
  );
  const activeApiModel = activeApi
    ? apiModels.find(
        (item) =>
          item.provider.id === activeApi.providerId &&
          item.model.id === activeApi.modelEntryId,
      )
    : apiModels[0];

  const resolvedAgentId = resolveSelectableAgentIdRuntime(
    agentsRuntime,
    agentId,
  );
  const agent =
    AGENT_DEFINITIONS.find((a) => a.id === resolvedAgentId) ??
    AGENT_DEFINITIONS[0]!;
  const runtimeState = getAgentRuntimeState(agentsRuntime, resolvedAgentId);
  const models = modelOptionsForAgent(runtimeState, resolvedAgentId);
  const currentModel =
    executionSource === "api"
      ? {
          id: activeApiModel?.model.modelId || settings.apiProvider.model || "default",
          label:
            activeApiModel?.model.label ||
            settings.apiProvider.model ||
            "未配置模型",
          providerLabel: activeApiModel
            ? activeApiModel.provider.displayName
            : providerDisplayName(settings.apiProvider),
        }
      : (models.find((m) => m.id === agentModel) ?? models[0]!);
  const menuAgents = getAvailableAgentsRuntime(agentsRuntime);
  const noneAvailable = menuAgents.length === 0 && !apiEnabled;

  useEffect(() => {
    if (executionSource === "api") return;
    const needsAgent = resolvedAgentId !== agentId;
    const needsModel = !models.some((m) => m.id === agentModel);
    if (needsAgent || needsModel) {
      onChange("cli", resolvedAgentId, currentModel.id);
    }
  }, [
    executionSource,
    agentId,
    agentModel,
    currentModel.id,
    models,
    onChange,
    resolvedAgentId,
  ]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const apiGroups = useMemo(() => {
    const map = new Map<
      string,
      { providerLabel: string; models: typeof apiModels }
    >();
    for (const item of apiModels) {
      const key = item.provider.id;
      const existing = map.get(key);
      if (existing) {
        existing.models.push(item);
      } else {
        map.set(key, {
          providerLabel: item.provider.displayName,
          models: [item],
        });
      }
    }
    return [...map.values()];
  }, [apiModels]);

  return (
    <div className="relative max-w-[11rem]" ref={rootRef}>
      <button
        type="button"
        className="control-picker control-picker--compact w-full"
        aria-label="选择执行源与模型"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={noneAvailable}
        title={
          noneAvailable
            ? "当前无可用智能体，请在设置中查看安装与授权状态"
            : executionSource === "api"
              ? `${"providerLabel" in currentModel ? currentModel.providerLabel : providerDisplayName(settings.apiProvider)} · ${currentModel.label}`
              : `${agentShortName(agent.name)} · ${currentModel.label}`
        }
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {executionSource === "cli" ? (
            <HermesStatusDot framed agentId={resolvedAgentId} />
          ) : (
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-100 text-[9px] font-semibold text-sky-800">
              API
            </span>
          )}
          <span className="min-w-0 truncate">
            {noneAvailable
              ? "无可用"
              : executionSource === "api"
                ? `${"providerLabel" in currentModel ? currentModel.providerLabel : providerDisplayName(settings.apiProvider)} · ${currentModel.label}`
                : currentModel.label}
          </span>
        </span>
        <ChevronDown
          className={`control-picker__chevron shrink-0 ${open ? "control-picker__chevron--open" : ""}`}
          strokeWidth={1.75}
        />
      </button>

      {open && !noneAvailable && (
        <ul
          className="control-picker-menu control-picker-menu--compact min-w-[11rem]"
          role="listbox"
        >
          {apiEnabled &&
            (apiGroups.length > 0 ? (
              apiGroups.map((group) => (
                <li
                  key={group.providerLabel}
                  role="presentation"
                  className="control-picker-menu__group"
                >
                  <p className="control-picker-menu__heading">
                    {group.providerLabel}
                  </p>
                  <ul className="control-picker-menu__options">
                    {group.models.map(({ provider, model }) => {
                      const selected =
                        executionSource === "api" &&
                        activeApi?.providerId === provider.id &&
                        activeApi?.modelEntryId === model.id;
                      return (
                        <li key={model.id} role="presentation">
                          <button
                            type="button"
                            role="option"
                            aria-selected={selected}
                            className={`control-picker-menu__item ${
                              selected
                                ? "control-picker-menu__item--selected"
                                : ""
                            }`}
                            onClick={() => {
                              updateSettings({
                                activeApiSelection: {
                                  providerId: provider.id,
                                  modelEntryId: model.id,
                                },
                              });
                              onChange("api", resolvedAgentId, model.modelId);
                              setOpen(false);
                            }}
                          >
                            <span className="whitespace-nowrap">
                              {model.label || model.modelId}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))
            ) : (
              <li role="presentation" className="control-picker-menu__group">
                <p className="control-picker-menu__heading">
                  {providerDisplayName(settings.apiProvider)}
                </p>
                <ul className="control-picker-menu__options">
                  <li role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={executionSource === "api"}
                      className={`control-picker-menu__item ${
                        executionSource === "api"
                          ? "control-picker-menu__item--selected"
                          : ""
                      }`}
                      onClick={() => {
                        onChange(
                          "api",
                          resolvedAgentId,
                          settings.apiProvider.model || "default",
                        );
                        setOpen(false);
                      }}
                    >
                      <span className="whitespace-nowrap">
                        {settings.apiProvider.model || "未配置模型"}
                      </span>
                    </button>
                  </li>
                </ul>
              </li>
            ))}
          {AGENT_DEFINITIONS.map((a) => {
            const agentDisabled = !isAgentAvailableRuntime(agentsRuntime, a.id);
            const agentModels = modelOptionsForAgent(
              getAgentRuntimeState(agentsRuntime, a.id),
              a.id,
            );
            return (
              <li key={a.id} role="presentation" className="control-picker-menu__group">
                <p className="control-picker-menu__heading">
                  {agentShortName(a.name)}
                </p>
                <ul className="control-picker-menu__options">
                  {agentModels.map((m) => {
                    const selected =
                      executionSource === "cli" &&
                      a.id === resolvedAgentId &&
                      m.id === currentModel.id;
                    return (
                      <li key={m.id} role="presentation">
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          disabled={agentDisabled}
                          title={
                            agentDisabled
                              ? cliStatusHintRuntime(agentsRuntime, a.id)
                              : undefined
                          }
                          className={`control-picker-menu__item ${
                            selected ? "control-picker-menu__item--selected" : ""
                          }`}
                          onClick={() => {
                            if (agentDisabled) return;
                            onChange("cli", a.id, m.id);
                            setOpen(false);
                          }}
                        >
                          <span className="whitespace-nowrap">{m.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
