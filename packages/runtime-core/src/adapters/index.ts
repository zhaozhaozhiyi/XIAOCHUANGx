import type { AgentId } from "../types.js";
import { claudeAdapter } from "./claude-adapter.js";
import { codexAdapter } from "./codex-adapter.js";
import { copilotAdapter } from "./copilot-adapter.js";
import { cursorAgentAdapter } from "./cursor-agent-adapter.js";
import { deepseekAdapter } from "./deepseek-adapter.js";
import { devinAdapter } from "./devin-adapter.js";
import { geminiAdapter } from "./gemini-adapter.js";
import { hermesAdapter } from "./hermes-adapter.js";
import { kiloAdapter } from "./kilo-adapter.js";
import { kiroAdapter } from "./kiro-adapter.js";
import { openclawAdapter } from "./openclaw-adapter.js";
import { opencodeAdapter } from "./opencode-adapter.js";
import { piAdapter } from "./pi-adapter.js";
import { qoderAdapter } from "./qoder-adapter.js";
import { vibeAdapter } from "./vibe-adapter.js";
import type { AgentAdapter } from "./types.js";

export const AGENT_ADAPTERS: Partial<Record<AgentId, AgentAdapter>> = {
  codex: codexAdapter,
  claude: claudeAdapter,
  hermes: hermesAdapter,
  "cursor-agent": cursorAgentAdapter,
  gemini: geminiAdapter,
  opencode: opencodeAdapter,
  copilot: copilotAdapter,
  qoder: qoderAdapter,
  deepseek: deepseekAdapter,
  devin: devinAdapter,
  pi: piAdapter,
  kiro: kiroAdapter,
  kilo: kiloAdapter,
  vibe: vibeAdapter,
  openclaw: openclawAdapter,
};

export function getAgentAdapter(agentId: AgentId): AgentAdapter {
  const adapter = AGENT_ADAPTERS[agentId];
  if (!adapter) {
    throw new Error(`adapter_not_implemented:${agentId}`);
  }
  return adapter;
}
