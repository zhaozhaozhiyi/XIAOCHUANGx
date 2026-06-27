import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function runtimeCoreDir(): string {
  return dirname(fileURLToPath(import.meta.url));
}

function repoRoot(): string {
  return join(runtimeCoreDir(), "..", "..", "..");
}

export function resolveSkillsRoot(): string {
  const fromEnv = process.env.JLC_SKILLS_DIR?.trim();
  if (fromEnv) return fromEnv;
  return join(repoRoot(), "skills");
}

export function resolvePromptsRoot(): string {
  const fromEnv = process.env.JLC_PROMPTS_DIR?.trim();
  if (fromEnv) return fromEnv;
  return join(repoRoot(), "prompts");
}

export function resolveAgentKitRoot(): string {
  const fromEnv = process.env.JLC_AGENT_KIT_DIR?.trim();
  if (fromEnv) return fromEnv;
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  return join(home, ".jlcresearch", "agent-kit");
}
