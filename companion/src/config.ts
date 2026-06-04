import { homedir, hostname } from "node:os";
import { join } from "node:path";
import { isAgentId, type AgentId } from "@jlc/runtime-core";

function envBool(name: string, defaultValue: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return defaultValue;
  return v === "1" || v.toLowerCase() === "true";
}

function envInt(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : defaultValue;
}

export type RunTimeoutProfile =
  | "default"
  | "fast"
  | "deep"
  | "writing"
  | "ppt";

export const PACKAGE_VERSION = "0.1.0";

export const config = {
  host: process.env.COMPANION_HOST ?? "127.0.0.1",
  port: Number(process.env.COMPANION_PORT ?? "9477"),
  dataDir:
    process.env.COMPANION_DATA_DIR ??
    join(homedir(), ".jlcresearch", "companion"),
  apiToken: process.env.COMPANION_API_TOKEN ?? "",
  companionId: process.env.COMPANION_ID ?? `host-${hostname()}`,
  /**
   * simulate — 服务端模拟 CLI 流式输出（无需安装 CLI）
   * spawn — 仅 --version 探测 + simulate 正文
   * cli — 通过 @jlc/runtime-core spawn 真实 CLI
   */
  runMode: (process.env.COMPANION_RUN_MODE ?? "cli") as
    | "simulate"
    | "spawn"
    | "cli",
  /**
   * cli 失败时：error = 仅 run.error（联调默认）；simulate = 回退模拟正文（UI 演示）
   */
  cliFallback: (process.env.COMPANION_CLI_FALLBACK ?? "error") as
    | "error"
    | "simulate",
  defaultAgentId: (
    isAgentId(process.env.COMPANION_DEFAULT_AGENT ?? "")
      ? process.env.COMPANION_DEFAULT_AGENT
      : "codex"
  ) as AgentId,
  /** Hermes Gateway（CLI 模式下降级前优先走 SSE tool.progress） */
  hermesApiUrl: (process.env.HERMES_API_URL ?? "http://127.0.0.1:8642").replace(
    /\/$/,
    "",
  ),
  hermesApiKey: process.env.HERMES_API_KEY ?? "",
  hermesModel: process.env.HERMES_MODEL ?? "hermes-agent",
  hermesGatewayPreferred: envBool("COMPANION_HERMES_GATEWAY", true),
  runTimeoutMs: envInt("COMPANION_RUN_TIMEOUT_MS", 300_000),
  runTimeoutFastMs: envInt("COMPANION_RUN_TIMEOUT_FAST_MS", 300_000),
  runTimeoutDeepMs: envInt("COMPANION_RUN_TIMEOUT_DEEP_MS", 1_800_000),
  runTimeoutWritingMs: envInt("COMPANION_RUN_TIMEOUT_WRITING_MS", 2_700_000),
  runTimeoutPptMs: envInt("COMPANION_RUN_TIMEOUT_PPT_MS", 3_600_000),
  runIdleTimeoutMs: envInt("COMPANION_RUN_IDLE_TIMEOUT_MS", 900_000),
} as const;

export function resolveRunTimeoutMs(
  profile: RunTimeoutProfile,
  explicitTimeoutMs?: number,
): number {
  if (typeof explicitTimeoutMs === "number" && explicitTimeoutMs > 0) {
    return explicitTimeoutMs;
  }
  switch (profile) {
    case "fast":
      return config.runTimeoutFastMs;
    case "deep":
      return config.runTimeoutDeepMs;
    case "writing":
      return config.runTimeoutWritingMs;
    case "ppt":
      return config.runTimeoutPptMs;
    default:
      return config.runTimeoutMs;
  }
}

export function resolveRunIdleTimeoutMs(explicitIdleTimeoutMs?: number): number {
  if (typeof explicitIdleTimeoutMs === "number" && explicitIdleTimeoutMs > 0) {
    return explicitIdleTimeoutMs;
  }
  return config.runIdleTimeoutMs;
}

export function projectsDir(): string {
  return join(config.dataDir, "projects");
}

export function sessionsDir(): string {
  return join(config.dataDir, "sessions");
}

export function isLoopbackHost(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

export function assertLoopbackBind(): void {
  if (!isLoopbackHost(config.host) && config.host !== "::ffff:127.0.0.1") {
    console.warn(
      `[companion] COMPANION_HOST=${config.host} 非 loopback，生产环境请勿暴露公网`,
    );
  }
}

export const useAuth = (): boolean => Boolean(config.apiToken);

export const authEnabled = envBool("COMPANION_AUTH_REQUIRED", false);
