import { AGENT_REGISTRY, type AgentModelOption } from "@jlc/runtime-core";
import type { AgentId } from "../types.js";

export { type AgentModelOption };

export const AGENT_FALLBACK_MODELS: Record<AgentId, AgentModelOption[]> =
  Object.fromEntries(
    Object.entries(AGENT_REGISTRY).map(([id, entry]) => [id, entry.fallbackModels]),
  ) as Record<AgentId, AgentModelOption[]>;

export const AGENT_DISPLAY_NAMES: Record<AgentId, string> = Object.fromEntries(
  Object.entries(AGENT_REGISTRY).map(([id, entry]) => [
    id,
    entry.execution.displayName,
  ]),
) as Record<AgentId, string>;
