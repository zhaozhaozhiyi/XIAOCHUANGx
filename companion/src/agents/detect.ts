import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  AGENT_IDS,
  AGENT_REGISTRY,
  getAgentRegistryEntry,
} from "@jlc/runtime-core";
import { AGENT_FALLBACK_MODELS } from "./catalog.js";
import type {
  AgentId,
  AgentTestResponse,
  CompanionAgentState,
  CompanionAgentsResponse,
} from "../types.js";
import { config } from "../config.js";

const execFileAsync = promisify(execFile);

const AGENT_BINS: Record<AgentId, string> = Object.fromEntries(
  AGENT_IDS.map((id) => [id, AGENT_REGISTRY[id].execution.bin]),
) as Record<AgentId, string>;

async function which(bin: string): Promise<string | null> {
  if (process.platform === "win32") {
    try {
      const { stdout } = await execFileAsync("where.exe", [bin], {
        timeout: 3000,
      });
      const path =
        stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find(
            (line) =>
              line.length > 0 && /\.(?:exe|cmd|bat|com)$/i.test(line),
          ) ?? null;
      return path;
    } catch {
      return null;
    }
  }

  try {
    const { stdout } = await execFileAsync("which", [bin], {
      timeout: 3000,
    });
    const path = stdout.trim();
    return path.length > 0 ? path : null;
  } catch {
    return null;
  }
}

async function resolveAgentPath(agentId: AgentId): Promise<string | null> {
  const spec = getAgentRegistryEntry(agentId);
  const candidates = [spec.execution.bin, ...(spec.execution.aliasBins ?? [])];
  for (const bin of candidates) {
    const path = await which(bin);
    if (path) return path;
  }
  return null;
}

async function readVersion(
  binPath: string,
): Promise<{ version: string | null; needsLogin: boolean }> {
  const flags: string[][] = [
    ["--version"],
    ["-v"],
    ["version"],
  ];

  for (const args of flags) {
    try {
      const { stdout, stderr } = await execFileAsync(binPath, args, {
        timeout: 5000,
      });
      const out = `${stdout}${stderr}`.trim();
      if (/login|auth|sign in/i.test(out)) {
        return { version: null, needsLogin: true };
      }
      const firstLine = out.split("\n")[0]?.trim() ?? "";
      if (firstLine) {
        return { version: firstLine.slice(0, 80), needsLogin: false };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/login|auth|not logged/i.test(msg)) {
        return { version: null, needsLogin: true };
      }
    }
  }

  return { version: null, needsLogin: false };
}

export async function detectAgent(agentId: AgentId): Promise<CompanionAgentState> {
  const spec = getAgentRegistryEntry(agentId);
  const bin = AGENT_BINS[agentId];
  const path = await resolveAgentPath(agentId);
  let models = AGENT_FALLBACK_MODELS[agentId];
  let modelsSource: "live" | "fallback" = "fallback";
  const capability = {
    supportsStreaming: true,
    supportsToolProgress: spec.execution.supportsToolProgress,
    supportsNarration: spec.execution.supportsNarration,
    supportsResumeThread: spec.execution.supportsThreadResume,
    supportsInterrupt: spec.execution.supportsInterrupt,
    supportsSteer: spec.execution.supportsSteer,
    supportsCompanionRun: spec.execution.supportsCompanionRun,
    inputMode: spec.execution.inputMode,
    streamFormat: spec.execution.streamFormat,
    transport: spec.execution.transport,
    skillInjection: spec.execution.skillInjection,
    prefersGateway: spec.execution.prefersGateway === true,
    unsupportedReason: spec.execution.unsupportedReason,
  };

  if (!path) {
    return {
      agentId,
      bin,
      status: "not_installed",
      version: null,
      hint: `未检测到 ${spec.execution.displayName}，请联系管理员安装`,
      models,
      modelsSource,
      capability,
    };
  }

  if (spec.fetchModels) {
    try {
      const liveModels = await spec.fetchModels(path);
      if (Array.isArray(liveModels) && liveModels.length > 0) {
        models = liveModels;
        modelsSource = "live";
      }
    } catch {
      /* fallback to static models */
    }
  }

  const { version, needsLogin } = await readVersion(path);
  if (needsLogin) {
    return {
      agentId,
      bin,
      status: "needs_login",
      version: null,
      hint: spec.execution.loginHint,
      path,
      models,
      modelsSource,
      capability,
    };
  }

  return {
    agentId,
    bin,
    status: spec.execution.supportsCompanionRun ? "available" : "outdated",
    version: version ?? "unknown",
    path,
    hint: spec.execution.supportsCompanionRun
      ? undefined
      : spec.execution.unsupportedReason,
    models,
    modelsSource,
    capability,
  };
}

/** 轻量连通性测试：复用单 Agent 探测，不 spawn 完整 Run */
export async function testAgent(
  agentId: AgentId,
): Promise<AgentTestResponse> {
  const state = await detectAgent(agentId);
  if (state.status === "available") {
    return {
      ok: true,
      agentId,
      message: state.version
        ? `已就绪（${state.version}）`
        : "已就绪",
    };
  }
  if (state.status === "needs_login") {
    return {
      ok: false,
      agentId,
      message: state.hint ?? "需要先完成 CLI 登录",
    };
  }
  if (state.status === "not_installed") {
    return {
      ok: false,
      agentId,
      message: state.hint ?? "未检测到该智能体组件",
    };
  }
  return {
    ok: false,
    agentId,
    message: state.hint ?? "智能体版本过低",
  };
}

export async function detectAllAgents(): Promise<CompanionAgentsResponse> {
  const agents = await Promise.all(
    (AGENT_IDS as readonly AgentId[]).map(detectAgent),
  );
  const anyAvailable = agents.some((a) => a.status === "available");
  return {
    agents,
    defaultAgentId: config.defaultAgentId,
    inferenceChannel: anyAvailable ? "cli" : "api_fallback",
  };
}

export function findAgentState(
  agents: CompanionAgentState[],
  agentId: AgentId,
): CompanionAgentState | undefined {
  return agents.find((a) => a.agentId === agentId);
}
