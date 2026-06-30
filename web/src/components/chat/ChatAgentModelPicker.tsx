"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { HermesStatusDot } from "@/components/chat/HermesStatusBadge";
import { useSettings } from "@/components/settings/SettingsContext";
import {
  getLlmModels,
  hasAnyConnectableProvider,
  hasAnyUsableProvider,
  resolveApiSelection,
} from "@/lib/byok/model-providers";
import {
  hasUsableApiProviderConfig,
  providerDisplayName,
  type ChatExecutionSource,
} from "@/lib/byok/shared";
import {
  getAgentRuntimeState,
  getAvailableAgentsRuntime,
  modelOptionsForAgent,
  resolveSelectableAgentIdRuntime,
} from "@/lib/agents-runtime";
import { AGENT_DEFINITIONS, type AgentId } from "@/lib/settings";

function agentShortName(name: string): string {
  return name.replace(" CLI", "");
}

function defaultModelLabel(mode: "compact" | "menu", subject: string): string {
  return mode === "menu" ? `${subject} 默认` : "默认模型";
}

function normalizeModelLabel(
  rawLabel: string | undefined,
  rawId: string | undefined,
  options: {
    mode: "compact" | "menu";
    subject: string;
  },
): string {
  const label = rawLabel?.trim() ?? "";
  const id = rawId?.trim().toLowerCase() ?? "";
  const lowered = label.toLowerCase();

  if (!label || lowered === "default" || id === "default") {
    return defaultModelLabel(options.mode, options.subject);
  }
  if (lowered === "auto" || id === "auto") {
    return options.mode === "menu" ? `${options.subject} 自动选择` : "自动选择";
  }
  return label;
}

type PickerTab = "cli" | "api";

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
  const [activeTab, setActiveTab] = useState<PickerTab>(executionSource);
  const rootRef = useRef<HTMLDivElement>(null);

  const apiModels = useMemo(
    () => getLlmModels(settings.modelProviders),
    [settings.modelProviders],
  );

  // API 选项可用：有可用的 Provider（有模型）或者有凭证就绪的 Provider
  const apiEnabled =
    hasAnyUsableProvider(settings.modelProviders) ||
    hasUsableApiProviderConfig(settings.apiProvider) ||
    hasAnyConnectableProvider(settings.modelProviders);

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

  const cliAgents = menuAgents;
  const cliReady = cliAgents.length > 0;
  const apiReady = apiEnabled && apiGroups.length > 0;
  const noneAvailable = !cliReady && !apiReady;
  const effectiveExecutionSource: ChatExecutionSource =
    executionSource === "api"
      ? apiReady
        ? "api"
        : "cli"
      : cliReady
        ? "cli"
        : "api";
  const preferredOpenTab: PickerTab =
    effectiveExecutionSource === "api" && apiReady ? "api" : "cli";

  const currentAgentName = agentShortName(agent.name);
  const currentProviderName =
    "providerLabel" in currentModel
      ? currentModel.providerLabel
      : providerDisplayName(settings.apiProvider);
  const currentTitle =
    effectiveExecutionSource === "api" ? currentProviderName : currentAgentName;
  const currentSubtitle =
    effectiveExecutionSource === "api"
      ? normalizeModelLabel(currentModel.label, currentModel.id, {
          mode: "compact",
          subject: currentProviderName,
        })
      : normalizeModelLabel(currentModel.label, currentModel.id, {
          mode: "compact",
          subject: currentAgentName,
        });

  useEffect(() => {
    if (noneAvailable) return;
    if (effectiveExecutionSource === executionSource) return;

    if (effectiveExecutionSource === "cli") {
      const nextAgentId = resolveSelectableAgentIdRuntime(agentsRuntime, agentId);
      const nextAgentState = getAgentRuntimeState(agentsRuntime, nextAgentId);
      const nextModels = modelOptionsForAgent(nextAgentState, nextAgentId);
      const nextModelId =
        nextModels.find((m) => m.id === agentModel)?.id ??
        nextModels[0]?.id ??
        "default";
      updateSettings({ executionSource: "cli" });
      onChange("cli", nextAgentId, nextModelId);
      return;
    }

    if (!activeApi || !activeApiModel) return;
    updateSettings({
      executionSource: "api",
      activeApiSelection: {
        providerId: activeApi.providerId,
        modelEntryId: activeApi.modelEntryId,
      },
    });
    onChange("api", resolvedAgentId, activeApiModel.model.modelId);
  }, [
    activeApi,
    activeApiModel,
    agentId,
    agentModel,
    agentsRuntime,
    effectiveExecutionSource,
    executionSource,
    noneAvailable,
    onChange,
    resolvedAgentId,
    updateSettings,
  ]);

  return (
    <div className="agent-model-picker relative w-full max-w-[14rem]" ref={rootRef}>
      <button
        type="button"
        className="control-picker control-picker--compact agent-model-picker__trigger w-full"
        aria-label="选择执行源与模型"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={noneAvailable}
        title={noneAvailable ? "当前无可用智能体，请在设置中查看安装与授权状态" : `${currentTitle} · ${currentSubtitle}`}
        onClick={() =>
          setOpen((o) => {
            const next = !o;
            if (next) setActiveTab(preferredOpenTab);
            return next;
          })
        }
      >
        <span className="agent-model-picker__trigger-content">
          {executionSource === "cli" ? (
            <HermesStatusDot framed agentId={resolvedAgentId} />
          ) : (
            <span className="agent-model-picker__source-badge">
              API
            </span>
          )}
          <span className="agent-model-picker__trigger-copy">
            <span className="agent-model-picker__trigger-title">
              {noneAvailable ? "无可用通道" : currentTitle}
            </span>
            <span className="agent-model-picker__trigger-subtitle">
              {noneAvailable ? "请先完成安装或配置" : currentSubtitle}
            </span>
          </span>
        </span>
        <ChevronDown
          className={`control-picker__chevron shrink-0 ${open ? "control-picker__chevron--open" : ""}`}
          strokeWidth={1.75}
        />
      </button>

      {open && !noneAvailable && (
        <div
          className="agent-model-picker__panel control-picker-menu control-picker-menu--compact"
          role="dialog"
          aria-label="选择执行源与模型"
        >
          <div className="agent-model-picker__summary">
            <p className="control-picker-menu__heading">当前选择</p>
            <div className="agent-model-picker__summary-card">
              <div className="agent-model-picker__summary-main">
                <span className="agent-model-picker__summary-title">
                  {currentTitle}
                </span>
                <span className="agent-model-picker__summary-subtitle">
                  {currentSubtitle}
                </span>
              </div>
              <span className="agent-model-picker__summary-channel">
                {effectiveExecutionSource === "api" ? "API" : "CLI"}
              </span>
            </div>
          </div>

          {cliReady && apiReady ? (
            <div className="agent-model-picker__tabs" role="tablist" aria-label="执行通道">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "cli"}
                className={`agent-model-picker__tab ${
                  activeTab === "cli" ? "agent-model-picker__tab--active" : ""
                }`}
                onClick={() => setActiveTab("cli")}
              >
                CLI 智能体
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "api"}
                className={`agent-model-picker__tab ${
                  activeTab === "api" ? "agent-model-picker__tab--active" : ""
                }`}
                onClick={() => setActiveTab("api")}
              >
                模型 API
              </button>
            </div>
          ) : null}

          <div className="agent-model-picker__body">
            {apiReady && (!cliReady || activeTab === "api") ? (
              apiGroups.length > 0 ? (
                  apiGroups.map((group) => (
                    <section
                      key={group.providerLabel}
                      className="agent-model-picker__section"
                    >
                      <p className="control-picker-menu__heading">
                        {group.providerLabel}
                      </p>
                      <div className="agent-model-picker__options">
                        {group.models.map(({ provider, model }) => {
                          const selected =
                            executionSource === "api" &&
                            activeApi?.providerId === provider.id &&
                            activeApi?.modelEntryId === model.id;
                          return (
                            <button
                              key={model.id}
                              type="button"
                              className={`control-picker-menu__item agent-model-picker__item ${
                                selected
                                  ? "control-picker-menu__item--selected agent-model-picker__item--selected"
                                  : ""
                              }`}
                              onClick={() => {
                                updateSettings({
                                  executionSource: "api",
                                  activeApiSelection: {
                                    providerId: provider.id,
                                    modelEntryId: model.id,
                                  },
                                });
                                onChange("api", resolvedAgentId, model.modelId);
                                setOpen(false);
                              }}
                            >
                              <span className="agent-model-picker__item-copy">
                                <span className="agent-model-picker__item-title">
                                  {normalizeModelLabel(model.label || model.modelId, model.modelId, {
                                    mode: "menu",
                                    subject: group.providerLabel,
                                  })}
                                </span>
                              </span>
                            {selected ? <Check className="agent-model-picker__check" /> : null}
                          </button>
                        );
                        })}
                      </div>
                    </section>
                  ))
              ) : (
                <section className="agent-model-picker__section">
                  <p className="control-picker-menu__heading">模型 API</p>
                  <div className="agent-model-picker__empty">
                    当前没有可显示的模型 API。
                  </div>
                </section>
              )
            ) : (
              cliAgents.map((a) => {
                const sectionName = agentShortName(a.name);
                const agentModels = modelOptionsForAgent(
                  getAgentRuntimeState(agentsRuntime, a.id),
                  a.id,
                );
                return (
                  <section key={a.id} className="agent-model-picker__section">
                    <p className="control-picker-menu__heading">{sectionName}</p>
                    <div className="agent-model-picker__options">
                      {agentModels.map((m) => {
                        const selected =
                          effectiveExecutionSource === "cli" &&
                          a.id === resolvedAgentId &&
                          m.id === currentModel.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            className={`control-picker-menu__item agent-model-picker__item ${
                              selected
                                ? "control-picker-menu__item--selected agent-model-picker__item--selected"
                                  : ""
                            }`}
                            onClick={() => {
                              updateSettings({
                                executionSource: "cli",
                                defaultAgentId: a.id,
                                agentModels: {
                                  ...settings.agentModels,
                                  [a.id]: m.id,
                                },
                              });
                              onChange("cli", a.id, m.id);
                              setOpen(false);
                            }}
                          >
                            <span className="agent-model-picker__item-copy">
                              <span className="agent-model-picker__item-title">
                                {normalizeModelLabel(m.label, m.id, {
                                  mode: "menu",
                                  subject: sectionName,
                                })}
                              </span>
                            </span>
                            {selected ? (
                              <Check className="agent-model-picker__check" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
