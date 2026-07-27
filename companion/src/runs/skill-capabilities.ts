import { constants, existsSync, accessSync } from "node:fs";
import { dirname, join } from "node:path";
import { resolveSkillsRoot } from "@jlc/runtime-core";

function platformDirectory(): string {
  if (process.platform === "darwin") return "darwin";
  if (process.platform === "win32") return "win32";
  return "linux";
}

function executableName(): string {
  return process.platform === "win32" ? "openscad.exe" : "openscad";
}

function isExecutable(path: string): boolean {
  if (!existsSync(path)) return false;
  try {
    accessSync(
      path,
      process.platform === "win32" ? constants.F_OK : constants.X_OK,
    );
    return true;
  } catch {
    return false;
  }
}

function openScadCandidates(): string[] {
  const skillsRoot = resolveSkillsRoot();
  const repositoryRoot = dirname(skillsRoot);
  const configuredRoot = process.env.JLC_OPENSCAD_RESOURCES_DIR?.trim();
  const roots = [
    configuredRoot,
    join(repositoryRoot, "engines", "openscad"),
    join(repositoryRoot, "apps", "desktop", "resources", "engines", "openscad"),
  ].filter((value): value is string => Boolean(value));
  const platform = platformDirectory();
  const name = executableName();
  const candidates = process.env.JLC_OPENSCAD_BIN?.trim()
    ? [process.env.JLC_OPENSCAD_BIN.trim()]
    : [];

  for (const root of roots) {
    candidates.push(join(root, platform, name), join(root, name));
    if (process.platform === "darwin") {
      candidates.push(
        join(root, platform, "OpenSCAD.app", "Contents", "MacOS", "OpenSCAD"),
        join(root, "OpenSCAD.app", "Contents", "MacOS", "OpenSCAD"),
      );
    }
  }
  return [...new Set(candidates)];
}

function envEnabled(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true";
}

/** Snapshot product capabilities once per Run before Companion selects a Skill. */
export function resolveAvailableSkillCapabilities(): ReadonlySet<string> {
  const capabilities = new Set<string>(["cad-runtime"]);
  for (const value of (
    process.env.COMPANION_AVAILABLE_SKILL_CAPABILITIES ?? ""
  ).split(",")) {
    const capability = value.trim();
    if (capability) capabilities.add(capability);
  }
  if (envEnabled("COMPANION_KNOWLEDGE_BASE_ENABLED")) {
    capabilities.add("knowledge-base");
  }
  if (openScadCandidates().some(isExecutable)) {
    capabilities.add("openscad-toolchain");
  }
  return capabilities;
}
