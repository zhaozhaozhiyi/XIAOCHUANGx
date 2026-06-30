"use client";

import { ChevronDown, RefreshCw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { AgentIcon } from "@/components/settings/AgentIcon";
import { useSettings } from "@/components/settings/SettingsContext";
import { ByokSettingsSection } from "@/components/settings/sections/ByokSettingsSection";
import { VoiceSettingsSection } from "@/components/settings/sections/VoiceSettingsSection";
import {
  cliStatusHintRuntime,
  getAgentRuntimeState,
  getAvailableAgentsRuntime,
  isAgentAvailableRuntime,
  modelOptionsForAgent,
  modelsSourceLabel,
  resolveSelectableAgentIdRuntime,
} from "@/lib/agents-runtime";
import type { AgentSettingsTab } from "@/lib/settings";
import {
  AGENT_DEFINITIONS,
  type AgentId,
  type CliStatus,
} from "@/lib/settings";

const AGENT_TABS: { id: AgentSettingsTab; label: string }[] = [
  { id: "cli", label: "CLI 智能体" },
  { id: "api", label: "模型 API" },
  { id: "voice", label: "语音模型" },
];

function statusLabel(status: CliStatus): string {
  switch (status) {
    case "available":
      return "可用";
    case "not_installed":
      return "未安装";
    case "needs_login":
      return "需登录";
    case "outdated":
      return "版本过低";
    case "timeout":
      return "探测超时";
  }
}

function statusClass(status: CliStatus): string {
  switch (status) {
    case "available":
      return "bg-emerald-50 text-emerald-800";
    case "needs_login":
      return "bg-amber-50 text-amber-900";
    case "timeout":
      return "bg-red-50 text-red-900";
    default:
      return "bg-[var(--border)] text-[var(--fg-secondary)]";
  }
}

function AgentSettingsAlerts() {
  const { agentsRuntime } = useSettings();
  const channel = agentsRuntime.inferenceChannel;

  return (
    <>
      {channel === "api_fallback" && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          role="status"
        >
          当前使用 API 降级模式，部分数据源与工作区能力受限。你可以先在下方按
          CLI 安装指引补齐本机智能体，或直接配置模型 API。
        </div>
      )}

      {agentsRuntime.error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
          role="alert"
        >
          {agentsRuntime.error}
        </div>
      )}
    </>
  );
}

function AgentCliSettingsPanel() {
  const {
    settings,
    updateSettings,
    agentsRuntime,
    refreshAgents,
    agentTest,
    runAgentTest,
  } = useSettings();
  const [rescanNotice, setRescanNotice] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const handleDetect = async () => {
    setRescanNotice(null);
    const { available, error } = await refreshAgents({ detect: true });
    if (error) {
      setRescanNotice({ kind: "error", text: "检测失败，请确认 Companion 已启动" });
    } else {
      setRescanNotice({
        kind: "success",
        text: `已刷新，${available} 个智能体可用`,
      });
    }
  };

  useEffect(() => {
    if (!rescanNotice) return;
    const t = window.setTimeout(() => setRescanNotice(null), 5000);
    return () => window.clearTimeout(t);
  }, [rescanNotice]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--fg)]">已登记 CLI 智能体</p>
          <p className="mt-0.5 text-xs text-[var(--fg-tertiary)]">
            支持对已登记的 CLI 进行自助安装、授权与重新检测；未登记的其他 CLI
            暂不支持接入
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {rescanNotice && (
            <span
              className={`text-[10px] ${
                rescanNotice.kind === "success"
                  ? "text-emerald-700"
                  : "text-red-700"
              }`}
            >
              {rescanNotice.text}
            </span>
          )}
          <button
            type="button"
            className="btn btn-secondary px-2.5 py-1.5 text-xs"
            onClick={() => void handleDetect()}
            disabled={agentsRuntime.loading}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${agentsRuntime.loading ? "animate-spin" : ""}`}
              strokeWidth={1.75}
            />
            重新检测
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {AGENT_DEFINITIONS.map((agent) => {
          const runtimeState = getAgentRuntimeState(agentsRuntime, agent.id);
          const status = runtimeState?.status ?? "not_installed";
          const selected = settings.defaultAgentId === agent.id;
          const models = modelOptionsForAgent(runtimeState, agent.id);
          const sourceHint = modelsSourceLabel(runtimeState?.modelsSource);

          return (
            <div
              key={agent.id}
              className={`flex flex-col rounded-xl border p-3 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] ${
                selected
                  ? "border-[var(--accent)] bg-[var(--accent-muted)] hover:border-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--accent)]/50"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
                  onClick={() =>
                    status === "available" &&
                    updateSettings({ defaultAgentId: agent.id })
                  }
                  disabled={status !== "available"}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                      selected
                        ? "border-[var(--accent)]/30 bg-[var(--surface-elevated)]"
                        : "border-[var(--border)] bg-[var(--surface)]"
                    }`}
                  >
                    <AgentIcon id={agent.id} size={22} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--fg)]">
                      {agent.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--fg-tertiary)]">
                      {agent.role}
                    </span>
                  </span>
                </button>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass(status)}`}
                >
                  {statusLabel(status)}
                </span>
              </div>
              <p
                className="mt-2 truncate font-mono text-[11px] text-[var(--fg-tertiary)]"
                title={runtimeState?.path}
              >
                {runtimeState?.version ? `v${runtimeState.version}` : "—"}
                {runtimeState?.hint ? ` · ${runtimeState.hint}` : ""}
              </p>
              {status !== "available" && (
                <div className="mt-auto space-y-2 border-t border-[var(--border)] pt-3">
                  <p className="text-xs text-[var(--fg-secondary)]">
                    {agent.selfServiceHint ??
                      "完成安装或授权后，回到这里重新检测即可。"}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {agent.installUrl && (
                      <a
                        href={agent.installUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[var(--accent)] hover:underline"
                      >
                        安装 / 配置指引
                      </a>
                    )}
                    {agent.docsUrl && (
                      <a
                        href={agent.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[var(--accent)] hover:underline"
                      >
                        官方文档
                      </a>
                    )}
                  </div>
                </div>
              )}
              {selected && status === "available" && (
                <div className="mt-auto space-y-2 border-t border-[var(--border)] pt-3">
                  <div>
                    <label className="text-overline block">默认模型</label>
                    {sourceHint && (
                      <p className="mt-0.5 text-[10px] text-[var(--fg-tertiary)]">
                        {sourceHint}
                      </p>
                    )}
                    <select
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-2.5 py-2 text-sm"
                      value={settings.agentModels[agent.id]}
                      onChange={(e) =>
                        updateSettings({
                          agentModels: {
                            ...settings.agentModels,
                            [agent.id]: e.target.value,
                          },
                        })
                      }
                    >
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary w-full py-1.5 text-xs"
                    disabled={agentTest.status === "running"}
                    onClick={() => void runAgentTest(agent.id)}
                  >
                    {agentTest.status === "running"
                      ? "测试中…"
                      : "测试连接"}
                  </button>
                  {agentTest.status !== "idle" && selected && (
                    <p
                      className={`text-xs ${
                        agentTest.status === "ok"
                          ? "text-emerald-700"
                          : agentTest.status === "error"
                            ? "text-red-700"
                            : "text-[var(--fg-tertiary)]"
                      }`}
                    >
                      {agentTest.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ConnectionStatusCard() {
  const { agentsRuntime } = useSettings();
  const channel = agentsRuntime.inferenceChannel;
  const companionLabel = !agentsRuntime.loaded
    ? "检测中…"
    : agentsRuntime.companionOk
      ? `已连接${agentsRuntime.companionVersion ? ` · v${agentsRuntime.companionVersion}` : ""}`
      : agentsRuntime.mode === "mock"
        ? "Mock 模式"
        : "未连接";

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            agentsRuntime.companionOk ? "bg-emerald-500" : "bg-amber-500"
          }`}
          aria-hidden="true"
        />
        <p className="text-overline">连接状态</p>
      </div>
      <ul className="mt-1.5 space-y-1 text-xs text-[var(--fg-secondary)]">
        <li className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-[var(--fg-tertiary)]">Companion</span>
          <span
            className={`truncate text-right ${
              agentsRuntime.companionOk ? "text-emerald-700" : "text-amber-800"
            }`}
            title={companionLabel}
          >
            {companionLabel}
          </span>
        </li>
        <li className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-[var(--fg-tertiary)]">执行模式</span>
          <span className="truncate text-right font-mono text-[11px]">
            {agentsRuntime.execution}
            {agentsRuntime.mode !== "unreachable"
              ? ` · ${agentsRuntime.mode}`
              : ""}
          </span>
        </li>
        <li className="flex items-center justify-between gap-2">
          <span className="shrink-0 text-[var(--fg-tertiary)]">推理通道</span>
          <span className="text-right">
            {channel === "cli" ? "CLI" : "API 降级"}
          </span>
        </li>
        {agentsRuntime.detectedAt && (
          <li className="flex items-center justify-between gap-2 text-[var(--fg-tertiary)]">
            <span className="shrink-0">上次探测</span>
            <span className="text-right">
              {new Date(agentsRuntime.detectedAt).toLocaleTimeString("zh-CN")}
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}

export function AgentSettingsSection() {
  const { agentSettingsTab, setAgentSettingsTab } = useSettings();
  const tablistId = useId();
  const cliPanelId = useId();
  const apiPanelId = useId();
  const voicePanelId = useId();

  const panelIdByTab: Record<AgentSettingsTab, string> = {
    cli: cliPanelId,
    api: apiPanelId,
    voice: voicePanelId,
  };

  return (
    <div className="space-y-4">
      <div
        className="settings-agent-tabs"
        role="tablist"
        aria-label="智能体配置通道"
        id={tablistId}
      >
        {AGENT_TABS.map((tab) => {
          const selected = agentSettingsTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${tablistId}-${tab.id}`}
              aria-selected={selected}
              aria-controls={panelIdByTab[tab.id]}
              className={`settings-agent-tabs__item ${
                selected ? "settings-agent-tabs__item--active" : ""
              }`}
              onClick={() => setAgentSettingsTab(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <AgentSettingsAlerts />

      <div
        role="tabpanel"
        id={cliPanelId}
        aria-labelledby={`${tablistId}-cli`}
        hidden={agentSettingsTab !== "cli"}
        className={agentSettingsTab === "cli" ? undefined : "hidden"}
      >
        <AgentCliSettingsPanel />
      </div>

      <div
        role="tabpanel"
        id={apiPanelId}
        aria-labelledby={`${tablistId}-api`}
        hidden={agentSettingsTab !== "api"}
        className={agentSettingsTab === "api" ? undefined : "hidden"}
      >
        <ByokSettingsSection />
      </div>

      <div
        role="tabpanel"
        id={voicePanelId}
        aria-labelledby={`${tablistId}-voice`}
        hidden={agentSettingsTab !== "voice"}
        className={agentSettingsTab === "voice" ? undefined : "hidden"}
      >
        <VoiceSettingsSection />
      </div>
    </div>
  );
}

function agentDisplayName(name: string): string {
  return name.replace(" CLI", "");
}

export function AgentPicker({
  value,
  onChange,
  compact,
}: {
  value: AgentId;
  onChange: (id: AgentId) => void;
  compact?: boolean;
}) {
  const { agentsRuntime } = useSettings();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const menuAgents = compact
    ? getAvailableAgentsRuntime(agentsRuntime)
    : AGENT_DEFINITIONS;
  const resolvedValue = resolveSelectableAgentIdRuntime(agentsRuntime, value);
  const current =
    AGENT_DEFINITIONS.find((a) => a.id === resolvedValue) ?? AGENT_DEFINITIONS[0]!;
  const noneAvailable = menuAgents.length === 0;

  useEffect(() => {
    if (resolvedValue !== value) {
      onChange(resolvedValue);
    }
  }, [resolvedValue, value, onChange]);

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

  return (
    <div
      className={`relative ${compact ? "max-w-[9.5rem]" : "max-w-[12rem]"}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={`control-picker w-full ${compact ? "control-picker--compact" : ""}`}
        aria-label="选择 Agent"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={noneAvailable}
        title={
          noneAvailable
            ? "当前无可用智能体，请在设置中查看安装与授权状态"
            : !isAgentAvailableRuntime(agentsRuntime, value) && compact
              ? cliStatusHintRuntime(agentsRuntime, value)
              : undefined
        }
        onClick={() => setOpen((o) => !o)}
      >
        <span className="min-w-0 truncate">
          {noneAvailable ? "无可用" : agentDisplayName(current.name)}
        </span>
        <ChevronDown
          className={`control-picker__chevron shrink-0 ${open ? "control-picker__chevron--open" : ""}`}
          strokeWidth={1.75}
        />
      </button>

      {open && !noneAvailable && (
        <ul
          className={`control-picker-menu ${compact ? "control-picker-menu--compact" : ""}`}
          role="listbox"
        >
          {menuAgents.map((a) => {
            const selected = a.id === resolvedValue;
            const disabled = !isAgentAvailableRuntime(agentsRuntime, a.id);
            return (
              <li key={a.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={disabled}
                  title={disabled ? cliStatusHintRuntime(agentsRuntime, a.id) : undefined}
                  className={`control-picker-menu__item ${
                    selected ? "control-picker-menu__item--selected" : ""
                  }`}
                  onClick={() => {
                    if (disabled) return;
                    onChange(a.id);
                    setOpen(false);
                  }}
                >
                  <span className="whitespace-nowrap">{agentDisplayName(a.name)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
