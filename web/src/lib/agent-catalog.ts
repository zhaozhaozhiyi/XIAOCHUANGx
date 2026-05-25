import {
  AGENT_CATALOG,
  type AgentModelOption,
} from "@jlc/runtime-core/agent-catalog";
import type { AgentId } from "@/lib/settings";

/** 与 runtime-core / companion 共享 */
export const AGENT_FALLBACK_MODELS: Record<AgentId, AgentModelOption[]> =
  Object.fromEntries(
    Object.entries(AGENT_CATALOG).map(([id, entry]) => [id, entry.fallbackModels]),
  ) as Record<AgentId, AgentModelOption[]>;
