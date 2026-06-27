import type { AgentId, StreamFormat } from "./types.js";

export type AgentModelOption = {
  id: string;
  label: string;
};

export type AgentExecutionProfile = {
  bin: string;
  aliasBins?: string[];
  displayName: string;
  streamFormat: StreamFormat;
  inputMode: "stdin" | "argv" | "stdin_json" | "rpc";
  transport: "stdio" | "gateway" | "acp" | "pi_rpc";
  skillInjection: "native" | "prompt" | "project_rules" | "mixed";
  supportsThreadResume: boolean;
  supportsInterrupt: boolean;
  supportsSteer: boolean;
  supportsToolProgress: boolean;
  supportsNarration: boolean;
  supportsCompanionRun: boolean;
  prefersGateway?: boolean;
  unsupportedReason?: string;
  loginHint?: string;
};

export type StaticAgentRegistryEntry = {
  id: AgentId;
  role: string;
  fallbackModels: AgentModelOption[];
  execution: AgentExecutionProfile;
};

export const STATIC_AGENT_REGISTRY: Record<AgentId, StaticAgentRegistryEntry> = {
  codex: {
    id: "codex",
    role: "默认推荐 · 写作 / PPT / 多文件工作区",
    fallbackModels: [
      { id: "default", label: "Default" },
      { id: "gpt-5.4", label: "gpt-5.4" },
      { id: "gpt-5.3-codex", label: "gpt-5.3-codex" },
    ],
    execution: {
      bin: "codex",
      displayName: "Codex CLI",
      streamFormat: "codex-json",
      inputMode: "stdin",
      transport: "stdio",
      skillInjection: "mixed",
      supportsThreadResume: true,
      supportsInterrupt: true,
      supportsSteer: false,
      supportsToolProgress: true,
      supportsNarration: true,
      supportsCompanionRun: true,
    },
  },
  claude: {
    id: "claude",
    role: "深度研究 · 纪要结构化",
    fallbackModels: [{ id: "default", label: "Default" }],
    execution: {
      bin: "claude",
      displayName: "Claude Code",
      streamFormat: "claude-jsonl",
      inputMode: "stdin_json",
      transport: "stdio",
      skillInjection: "native",
      supportsThreadResume: false,
      supportsInterrupt: true,
      supportsSteer: false,
      supportsToolProgress: true,
      supportsNarration: true,
      supportsCompanionRun: true,
      loginHint: "请在终端执行 claude 完成登录",
    },
  },
  hermes: {
    id: "hermes",
    role: "对话 · 工具编排扩展",
    fallbackModels: [
      { id: "default", label: "Default" },
      { id: "hermes-1", label: "Hermes 默认" },
    ],
    execution: {
      bin: "hermes",
      displayName: "Hermes CLI",
      streamFormat: "plain",
      inputMode: "stdin",
      transport: "gateway",
      skillInjection: "prompt",
      supportsThreadResume: false,
      supportsInterrupt: true,
      supportsSteer: false,
      supportsToolProgress: false,
      supportsNarration: false,
      supportsCompanionRun: true,
      prefersGateway: true,
    },
  },
  "cursor-agent": {
    id: "cursor-agent",
    role: "工程工作区 · Cursor Agent 会话委托",
    fallbackModels: [
      { id: "default", label: "Default" },
      { id: "auto", label: "auto" },
      { id: "sonnet-4", label: "sonnet-4" },
      { id: "sonnet-4-thinking", label: "sonnet-4-thinking" },
      { id: "gpt-5", label: "gpt-5" },
    ],
    execution: {
      bin: "cursor-agent",
      displayName: "Cursor Agent",
      streamFormat: "json-event-stream",
      inputMode: "stdin",
      transport: "stdio",
      skillInjection: "project_rules",
      supportsThreadResume: false,
      supportsInterrupt: true,
      supportsSteer: false,
      supportsToolProgress: true,
      supportsNarration: true,
      supportsCompanionRun: true,
      loginHint: "请先执行 cursor-agent login，并确认 cursor-agent status 正常",
    },
  },
  gemini: {
    id: "gemini",
    role: "高速多模态 · Gemini CLI",
    fallbackModels: [
      { id: "default", label: "Default" },
      { id: "gemini-3-pro-preview", label: "gemini-3-pro-preview" },
      { id: "gemini-3-flash-preview", label: "gemini-3-flash-preview" },
      { id: "gemini-2.5-pro", label: "gemini-2.5-pro" },
      { id: "gemini-2.5-flash", label: "gemini-2.5-flash" },
      { id: "gemini-2.5-flash-lite", label: "gemini-2.5-flash-lite" },
    ],
    execution: {
      bin: "gemini",
      displayName: "Gemini CLI",
      streamFormat: "json-event-stream",
      inputMode: "stdin",
      transport: "stdio",
      skillInjection: "prompt",
      supportsThreadResume: false,
      supportsInterrupt: true,
      supportsSteer: false,
      supportsToolProgress: true,
      supportsNarration: true,
      supportsCompanionRun: true,
    },
  },
  opencode: {
    id: "opencode",
    role: "开放代理编排 · OpenCode",
    fallbackModels: [
      { id: "default", label: "Default" },
      {
        id: "anthropic/claude-sonnet-4-5",
        label: "anthropic/claude-sonnet-4-5",
      },
      { id: "openai/gpt-5", label: "openai/gpt-5" },
      { id: "google/gemini-2.5-pro", label: "google/gemini-2.5-pro" },
    ],
    execution: {
      bin: "opencode",
      aliasBins: ["opencode-cli"],
      displayName: "OpenCode",
      streamFormat: "json-event-stream",
      inputMode: "stdin",
      transport: "stdio",
      skillInjection: "mixed",
      supportsThreadResume: false,
      supportsInterrupt: true,
      supportsSteer: false,
      supportsToolProgress: true,
      supportsNarration: true,
      supportsCompanionRun: true,
    },
  },
  copilot: {
    id: "copilot",
    role: "GitHub 生态 · Copilot CLI",
    fallbackModels: [
      { id: "default", label: "Default" },
      { id: "claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
      { id: "gpt-5.2", label: "GPT-5.2" },
    ],
    execution: {
      bin: "copilot",
      displayName: "GitHub Copilot CLI",
      streamFormat: "copilot-stream-json",
      inputMode: "stdin",
      transport: "stdio",
      skillInjection: "prompt",
      supportsThreadResume: false,
      supportsInterrupt: true,
      supportsSteer: false,
      supportsToolProgress: true,
      supportsNarration: true,
      supportsCompanionRun: true,
      loginHint: "请先执行 copilot login 完成 CLI 授权",
    },
  },
  qoder: {
    id: "qoder",
    role: "Qoder CLI · 企业代码代理",
    fallbackModels: [
      { id: "default", label: "Default" },
      { id: "lite", label: "Lite" },
      { id: "efficient", label: "Efficient" },
      { id: "auto", label: "Auto" },
      { id: "performance", label: "Performance" },
      { id: "ultimate", label: "Ultimate" },
    ],
    execution: {
      bin: "qodercli",
      displayName: "Qoder CLI",
      streamFormat: "qoder-stream-json",
      inputMode: "stdin",
      transport: "stdio",
      skillInjection: "prompt",
      supportsThreadResume: false,
      supportsInterrupt: true,
      supportsSteer: false,
      supportsToolProgress: true,
      supportsNarration: true,
      supportsCompanionRun: true,
    },
  },
  deepseek: {
    id: "deepseek",
    role: "DeepSeek TUI · 长上下文执行",
    fallbackModels: [
      { id: "default", label: "Default" },
      { id: "deepseek-v4-pro", label: "deepseek-v4-pro" },
      { id: "deepseek-v4-flash", label: "deepseek-v4-flash" },
    ],
    execution: {
      bin: "deepseek",
      displayName: "DeepSeek TUI",
      streamFormat: "plain",
      inputMode: "argv",
      transport: "stdio",
      skillInjection: "prompt",
      supportsThreadResume: false,
      supportsInterrupt: true,
      supportsSteer: false,
      supportsToolProgress: false,
      supportsNarration: false,
      supportsCompanionRun: true,
      loginHint:
        "请先配置 ~/.deepseek/config.toml 或 DEEPSEEK_API_KEY，再重试",
    },
  },
  devin: {
    id: "devin",
    role: "ACP 代理 · Devin for Terminal",
    fallbackModels: [
      { id: "default", label: "Default" },
      { id: "adaptive", label: "adaptive" },
      { id: "swe", label: "swe" },
      { id: "opus", label: "opus" },
      { id: "sonnet", label: "sonnet" },
      { id: "codex", label: "codex" },
      { id: "gpt", label: "gpt" },
      { id: "gemini", label: "gemini" },
    ],
    execution: {
      bin: "devin",
      displayName: "Devin for Terminal",
      streamFormat: "acp-json-rpc",
      inputMode: "rpc",
      transport: "acp",
      skillInjection: "prompt",
      supportsThreadResume: true,
      supportsInterrupt: true,
      supportsSteer: false,
      supportsToolProgress: true,
      supportsNarration: true,
      supportsCompanionRun: true,
      loginHint: "请先完成 Devin CLI 授权，并确认 devin --version / devin acp 可用",
    },
  },
  pi: {
    id: "pi",
    role: "Pi RPC · 多供应商代理",
    fallbackModels: [
      { id: "default", label: "Default" },
      {
        id: "anthropic/claude-sonnet-4-5",
        label: "Claude Sonnet 4.5 (anthropic)",
      },
      { id: "anthropic/claude-opus-4-5", label: "Claude Opus 4.5 (anthropic)" },
      { id: "openai/gpt-5", label: "GPT-5 (openai)" },
      { id: "openai/o4-mini", label: "o4-mini (openai)" },
      { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (google)" },
      { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (google)" },
    ],
    execution: {
      bin: "pi",
      displayName: "Pi",
      streamFormat: "pi-rpc",
      inputMode: "rpc",
      transport: "pi_rpc",
      skillInjection: "prompt",
      supportsThreadResume: true,
      supportsInterrupt: true,
      supportsSteer: false,
      supportsToolProgress: true,
      supportsNarration: true,
      supportsCompanionRun: true,
      loginHint: "请先确认 Pi CLI 已安装并完成 provider / auth 配置",
    },
  },
  kiro: {
    id: "kiro",
    role: "ACP 代理 · Kiro CLI",
    fallbackModels: [{ id: "default", label: "Default" }],
    execution: {
      bin: "kiro-cli",
      displayName: "Kiro CLI",
      streamFormat: "acp-json-rpc",
      inputMode: "rpc",
      transport: "acp",
      skillInjection: "prompt",
      supportsThreadResume: true,
      supportsInterrupt: true,
      supportsSteer: false,
      supportsToolProgress: true,
      supportsNarration: true,
      supportsCompanionRun: true,
      loginHint: "请先确认 Kiro CLI 已安装并可执行 kiro-cli acp",
    },
  },
  kilo: {
    id: "kilo",
    role: "ACP 代理 · Kilo",
    fallbackModels: [{ id: "default", label: "Default" }],
    execution: {
      bin: "kilo",
      displayName: "Kilo",
      streamFormat: "acp-json-rpc",
      inputMode: "rpc",
      transport: "acp",
      skillInjection: "prompt",
      supportsThreadResume: true,
      supportsInterrupt: true,
      supportsSteer: false,
      supportsToolProgress: true,
      supportsNarration: true,
      supportsCompanionRun: true,
      loginHint: "请先确认 Kilo CLI 已安装并可执行 kilo acp",
    },
  },
  vibe: {
    id: "vibe",
    role: "ACP 代理 · Vibe",
    fallbackModels: [{ id: "default", label: "Default" }],
    execution: {
      bin: "vibe-acp",
      displayName: "Mistral Vibe CLI",
      streamFormat: "acp-json-rpc",
      inputMode: "rpc",
      transport: "acp",
      skillInjection: "prompt",
      supportsThreadResume: true,
      supportsInterrupt: true,
      supportsSteer: false,
      supportsToolProgress: true,
      supportsNarration: true,
      supportsCompanionRun: true,
      loginHint: "请先确认 Vibe CLI 已安装并可直接启动 vibe-acp",
    },
  },
  openclaw: {
    id: "openclaw",
    role: "实验性代理 · OpenClaw",
    fallbackModels: [{ id: "default", label: "Default" }],
    execution: {
      bin: "openclaw",
      displayName: "OpenClaw",
      streamFormat: "plain",
      inputMode: "stdin",
      transport: "stdio",
      skillInjection: "prompt",
      supportsThreadResume: false,
      supportsInterrupt: true,
      supportsSteer: false,
      supportsToolProgress: false,
      supportsNarration: false,
      supportsCompanionRun: true,
      loginHint: "请先确认 OpenClaw CLI 已安装，并支持 infer model run headless 模式",
    },
  },
};

export function listStaticAgentRegistryEntries(): StaticAgentRegistryEntry[] {
  return Object.values(STATIC_AGENT_REGISTRY);
}

export function getStaticAgentRegistryEntry(
  agentId: AgentId,
): StaticAgentRegistryEntry {
  return STATIC_AGENT_REGISTRY[agentId];
}
