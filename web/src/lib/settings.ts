import { AGENT_FALLBACK_MODELS } from "@/lib/agent-catalog";
import {
  AGENT_CATALOG,
  AGENT_IDS,
  type AgentId,
} from "@jlc/runtime-core/agent-catalog";
import {
  DEFAULT_API_PROVIDER_CONFIG,
  type ApiProviderConfig,
  type ChatExecutionSource,
} from "@/lib/byok/shared";
import type { ChatModeId } from "@/lib/navigation";
import { normalizeChatMode } from "@/lib/navigation";

export type { AgentId } from "@jlc/runtime-core/agent-catalog";

export type CliStatus = "available" | "not_installed" | "needs_login" | "outdated";

export type InferenceChannel = "cli" | "api_fallback";

/** 智能体与模型设置页内 Tab */
export type AgentSettingsTab = "cli" | "api";

export type SettingsSectionId =
  | "agent"
  | "chat_defaults"
  | "charts"
  | "workspace"
  | "knowledge"
  | "account"
  | "about"
  | "admin";

export type SettingsMenuItem = {
  id: SettingsSectionId;
  label: string;
  description?: string;
  /** 是否在用户区弹出菜单中展示 */
  inPopover: boolean;
  /** MVP 是否在弹出菜单中展示（其余项仅在设置抽屉导航出现） */
  inPopoverMvp?: boolean;
  /** 是否仅管理员可见 */
  adminOnly?: boolean;
  /** V1.1 占位 */
  comingSoon?: boolean;
};

export const SETTINGS_MENU: SettingsMenuItem[] = [
  {
    id: "agent",
    label: "智能体与模型",
    description: "预置 CLI 与模型 API 通道配置",
    inPopover: true,
    inPopoverMvp: true,
  },
  {
    id: "chat_defaults",
    label: "研究与对话默认",
    inPopover: true,
    comingSoon: true,
  },
  {
    id: "charts",
    label: "数据与图表",
    inPopover: false,
    comingSoon: true,
  },
  {
    id: "workspace",
    label: "工作区",
    inPopover: true,
    comingSoon: true,
  },
  {
    id: "knowledge",
    label: "知识库",
    inPopover: false,
    comingSoon: true,
  },
  { id: "account", label: "账号与权限", inPopover: true, inPopoverMvp: true },
  { id: "about", label: "关于与帮助", inPopover: true, inPopoverMvp: true },
  {
    id: "admin",
    label: "功能与审计",
    inPopover: true,
    adminOnly: true,
    comingSoon: true,
  },
];

export type AgentDefinition = {
  id: AgentId;
  name: string;
  bin: string;
  role: string;
  models: { id: string; label: string }[];
};

export const AGENT_DEFINITIONS: AgentDefinition[] = AGENT_IDS.map((id) => ({
  id,
  name: AGENT_CATALOG[id].execution.displayName,
  bin: AGENT_CATALOG[id].execution.bin,
  role: AGENT_CATALOG[id].role,
  models: AGENT_FALLBACK_MODELS[id],
}));

/** 仅 COMPANION_USE_MOCK 时 BFF 使用的演示探测结果 */
export const MOCK_CLI_STATES: Record<
  AgentId,
  { status: CliStatus; version: string | null; hint?: string }
> = {
  codex: { status: "available", version: "0.7.0" },
  claude: { status: "needs_login", version: null, hint: "请在终端执行 claude 完成登录" },
  hermes: { status: "available", version: "1.2.0" },
  "cursor-agent": {
    status: "needs_login",
    version: null,
    hint: "请先执行 cursor-agent login",
  },
  gemini: { status: "available", version: "0.1.x" },
  opencode: { status: "available", version: "1.14.x" },
  copilot: { status: "needs_login", version: null, hint: "请先执行 copilot login" },
  qoder: { status: "available", version: "0.0.x" },
  deepseek: {
    status: "needs_login",
    version: null,
    hint: "请配置 ~/.deepseek/config.toml 或 DEEPSEEK_API_KEY",
  },
  devin: {
    status: "needs_login",
    version: "2026.5.x",
    hint: "请先完成 Devin CLI 授权，并确认 devin acp 可用",
  },
  pi: {
    status: "needs_login",
    version: "0.x",
    hint: "请先确认 Pi CLI 已完成 provider / auth 配置",
  },
  kiro: {
    status: "needs_login",
    version: "0.x",
    hint: "请先确认 kiro-cli acp 可用",
  },
  kilo: {
    status: "needs_login",
    version: "0.x",
    hint: "请先确认 kilo acp 可用",
  },
  vibe: {
    status: "needs_login",
    version: "0.x",
    hint: "请先确认 vibe-acp 可直接启动",
  },
  openclaw: {
    status: "needs_login",
    version: "0.x",
    hint: "请先确认 OpenClaw CLI 可用，并支持 infer model run headless 模式",
  },
};

export type UserSettings = {
  executionSource: ChatExecutionSource;
  defaultAgentId: AgentId;
  agentModels: Record<AgentId, string>;
  apiProvider: ApiProviderConfig;
  defaultChatMode: ChatModeId;
  rememberLastChatMode: boolean;
  workspaceOpenByDefault: boolean;
  workspaceRememberWidth: boolean;
  showAgentTerminalTab: boolean;
  promptSaveToKnowledgeBase: boolean;
  /** 原型：切换以预览管理员菜单 */
  simulateAdmin: boolean;
};

const STORAGE_KEY = "jlc-research-settings-v1";
const STORAGE_KEY_V2 = "jlc-research-settings-v2";

export const DEFAULT_SETTINGS: UserSettings = {
  executionSource: "cli",
  defaultAgentId: "codex",
  agentModels: Object.fromEntries(
    AGENT_IDS.map((id) => [id, "default"]),
  ) as Record<AgentId, string>,
  apiProvider: DEFAULT_API_PROVIDER_CONFIG,
  defaultChatMode: "fast",
  rememberLastChatMode: true,
  workspaceOpenByDefault: false,
  workspaceRememberWidth: true,
  showAgentTerminalTab: true,
  promptSaveToKnowledgeBase: true,
  simulateAdmin: false,
};

function migrateChatMode(mode: unknown): ChatModeId {
  if (typeof mode !== "string") return DEFAULT_SETTINGS.defaultChatMode;
  return normalizeChatMode(mode) ?? DEFAULT_SETTINGS.defaultChatMode;
}

export function loadSettings(): UserSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const v2 = localStorage.getItem(STORAGE_KEY_V2);
    if (v2) {
      const parsed = JSON.parse(v2) as Partial<UserSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        apiProvider: {
          ...DEFAULT_SETTINGS.apiProvider,
          ...(parsed.apiProvider ?? {}),
        },
        defaultChatMode: migrateChatMode(parsed.defaultChatMode),
      };
    }
    const v1 = localStorage.getItem(STORAGE_KEY);
    if (v1) {
      const parsed = JSON.parse(v1) as Partial<UserSettings>;
      const migrated: UserSettings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        apiProvider: {
          ...DEFAULT_SETTINGS.apiProvider,
          ...(parsed.apiProvider ?? {}),
        },
        defaultChatMode: migrateChatMode(parsed.defaultChatMode),
        workspaceOpenByDefault: false,
      };
      saveSettings(migrated);
      return migrated;
    }
    return DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: UserSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(settings));
}

/** @deprecated 请使用 SettingsContext 中的 agentsRuntime */
export function isAgentAvailable(id: AgentId): boolean {
  return MOCK_CLI_STATES[id].status === "available";
}

/** @deprecated 请使用 getAvailableAgentsRuntime */
export function getAvailableAgents(): AgentDefinition[] {
  return AGENT_DEFINITIONS.filter((a) => isAgentAvailable(a.id));
}

/** @deprecated 请使用 resolveSelectableAgentIdRuntime */
export function resolveSelectableAgentId(preferred: AgentId): AgentId {
  if (isAgentAvailable(preferred)) return preferred;
  return getAvailableAgents()[0]?.id ?? preferred;
}

/** @deprecated 请使用 cliStatusHintRuntime */
export function cliStatusHint(id: AgentId): string | undefined {
  const state = MOCK_CLI_STATES[id];
  if (state.status === "available") return undefined;
  if (state.hint) return state.hint;
  switch (state.status) {
    case "needs_login":
      return "该智能体需完成 CLI 授权后方可使用";
    case "not_installed":
      return "未检测到该智能体组件，请联系管理员安装";
    case "outdated":
      return "智能体版本过低，请升级后使用";
  }
}

/** @deprecated 请使用 agentsRuntime.inferenceChannel */
export function getInferenceChannel(): InferenceChannel {
  const anyAvailable = Object.values(MOCK_CLI_STATES).some(
    (s) => s.status === "available",
  );
  return anyAvailable ? "cli" : "api_fallback";
}

export function agentLabel(id: AgentId): string {
  return AGENT_DEFINITIONS.find((a) => a.id === id)?.name ?? id;
}

export function visibleMenuItems(simulateAdmin: boolean): SettingsMenuItem[] {
  return SETTINGS_MENU.filter(
    (item) => !item.adminOnly || simulateAdmin,
  );
}

export function popoverMenuItems(simulateAdmin: boolean): SettingsMenuItem[] {
  return visibleMenuItems(simulateAdmin).filter(
    (item) =>
      item.inPopover &&
      (item.inPopoverMvp || item.comingSoon === true),
  );
}
