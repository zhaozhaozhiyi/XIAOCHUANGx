import { spawn } from "node:child_process";
import {
  AGENT_REGISTRY,
  buildResolvedCommandArgs,
  resolveWindowsCommand,
  type AgentId,
} from "@jlc/runtime-core";

const BINS: Record<AgentId, string> = Object.fromEntries(
  Object.entries(AGENT_REGISTRY).map(([id, entry]) => [id, entry.execution.bin]),
) as Record<AgentId, string>;

/**
 * MVP：仅探测能否在 cwd 下启动并读取 --version。
 * 完整对话 spawn（stdin/stdout 协议）在后续与 runtime-core 对齐。
 */
export async function trySpawnVersionProbe(
  agentId: AgentId,
  cwd: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; output: string }> {
  const command = resolveWindowsCommand(BINS[agentId]);
  const args = buildResolvedCommandArgs(command, ["--version"]);
  return new Promise((resolve) => {
    const child = spawn(command.bin, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
      windowsVerbatimArguments: command.windowsVerbatimArguments,
    });

    let out = "";
    const onAbort = () => {
      child.kill("SIGTERM");
      resolve({ ok: false, output: "aborted" });
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    child.stdout?.on("data", (d) => {
      out += String(d);
    });
    child.stderr?.on("data", (d) => {
      out += String(d);
    });

    child.on("error", () => {
      signal?.removeEventListener("abort", onAbort);
      resolve({ ok: false, output: "" });
    });

    child.on("close", (code) => {
      signal?.removeEventListener("abort", onAbort);
      resolve({ ok: code === 0 || out.length > 0, output: out.trim() });
    });
  });
}
