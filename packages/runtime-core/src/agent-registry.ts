import {
  STATIC_AGENT_REGISTRY,
  type AgentExecutionProfile,
  type AgentModelOption,
  type StaticAgentRegistryEntry,
} from "./agent-registry-static.js";
import type { AgentId } from "./types.js";

export type { AgentExecutionProfile, AgentModelOption };

async function detectAcpModels(
  bin: string,
  args: string[],
  fallback: AgentModelOption[],
  signal?: AbortSignal,
): Promise<AgentModelOption[]> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);

  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      timeout: 15_000,
      maxBuffer: 8 * 1024 * 1024,
      signal,
    });
    const text = `${stdout}\n${stderr}`;
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return fallback;
    const seen = new Set<string>();
    const out: AgentModelOption[] = [{ id: "default", label: "Default" }];
    seen.add("default");
    for (const line of lines) {
      if (!line.startsWith("{")) continue;
      try {
        const obj = JSON.parse(line) as Record<string, unknown>;
        const result =
          typeof obj?.result === "object" && obj.result
            ? (obj.result as Record<string, unknown>)
            : null;
        const models =
          result && typeof result.models === "object" && result.models
            ? (result.models as Record<string, unknown>)
            : null;
        const available = Array.isArray(models?.availableModels)
          ? models?.availableModels
          : [];
        for (const item of available) {
          const record =
            typeof item === "object" && item ? (item as Record<string, unknown>) : null;
          const id =
            typeof record?.modelId === "string" && record.modelId.trim()
              ? record.modelId.trim()
              : "";
          if (!id || seen.has(id)) continue;
          seen.add(id);
          out.push({ id, label: id });
        }
      } catch {
        /* ignore parse noise */
      }
    }
    return out.length > 1 ? out : fallback;
  } catch {
    return fallback;
  }
}

async function detectPiModels(
  bin: string,
  fallback: AgentModelOption[],
  signal?: AbortSignal,
): Promise<AgentModelOption[]> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  const { parsePiModels } = await import("./rpc-bridge.js");

  try {
    const { stderr } = await execFileAsync(bin, ["--list-models"], {
      timeout: 20_000,
      maxBuffer: 8 * 1024 * 1024,
      signal,
    });
    return parsePiModels(stderr) ?? fallback;
  } catch {
    return fallback;
  }
}

export type AgentRegistryEntry = {
} & StaticAgentRegistryEntry & {
  fetchModels?: (
    resolvedBin: string,
    signal?: AbortSignal,
  ) => Promise<AgentModelOption[]>;
};

export const AGENT_REGISTRY: Record<AgentId, AgentRegistryEntry> = {
  ...STATIC_AGENT_REGISTRY,
  devin: {
    ...STATIC_AGENT_REGISTRY.devin,
    fetchModels: async (resolvedBin, signal) =>
      detectAcpModels(
        resolvedBin,
        [
          "--permission-mode",
          "dangerous",
          "--respect-workspace-trust",
          "false",
          "acp",
        ],
        AGENT_REGISTRY.devin.fallbackModels,
        signal,
      ),
  },
  pi: {
    ...STATIC_AGENT_REGISTRY.pi,
    fetchModels: async (resolvedBin, signal) =>
      detectPiModels(resolvedBin, AGENT_REGISTRY.pi.fallbackModels, signal),
  },
  kiro: {
    ...STATIC_AGENT_REGISTRY.kiro,
    fetchModels: async (resolvedBin, signal) =>
      detectAcpModels(
        resolvedBin,
        ["acp"],
        AGENT_REGISTRY.kiro.fallbackModels,
        signal,
      ),
  },
  kilo: {
    ...STATIC_AGENT_REGISTRY.kilo,
    fetchModels: async (resolvedBin, signal) =>
      detectAcpModels(
        resolvedBin,
        ["acp"],
        AGENT_REGISTRY.kilo.fallbackModels,
        signal,
      ),
  },
  vibe: {
    ...STATIC_AGENT_REGISTRY.vibe,
    fetchModels: async (resolvedBin, signal) =>
      detectAcpModels(
        resolvedBin,
        [],
        AGENT_REGISTRY.vibe.fallbackModels,
        signal,
      ),
  },
};

export function listAgentRegistryEntries(): AgentRegistryEntry[] {
  return Object.values(AGENT_REGISTRY);
}

export function getAgentRegistryEntry(agentId: AgentId): AgentRegistryEntry {
  return AGENT_REGISTRY[agentId];
}
