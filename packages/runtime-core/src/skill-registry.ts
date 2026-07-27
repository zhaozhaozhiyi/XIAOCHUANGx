import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  skillRegistryV1Schema,
  type SkillManifestV1,
  type SkillRegistryV1,
} from "@jlc/contracts";
import { resolveSkillsRoot } from "./paths.js";

const REGISTRY_FILENAME = "skill-registry.generated.json";

export type SkillRegistrySnapshot = {
  registry: SkillRegistryV1;
  bySlug: ReadonlyMap<string, SkillManifestV1>;
  moduleBindings: ReadonlyMap<string, string>;
  templateBindings: ReadonlyMap<string, string>;
};

export type SkillRegistryMetrics = {
  registryLoadCount: number;
  registryLoadMs: number;
  skillFilesystemScanCount: number;
};

const registryCache = new Map<string, SkillRegistrySnapshot>();
const metrics: SkillRegistryMetrics = {
  registryLoadCount: 0,
  registryLoadMs: 0,
  skillFilesystemScanCount: 0,
};

function buildSnapshot(registry: SkillRegistryV1): SkillRegistrySnapshot {
  const bySlug = new Map<string, SkillManifestV1>();
  const moduleBindings = new Map<string, string>();
  const templateBindings = new Map<string, string>();

  for (const manifest of registry.skills) {
    bySlug.set(manifest.slug, manifest);
    for (const moduleId of manifest.bindings.moduleIds) {
      moduleBindings.set(moduleId, manifest.slug);
    }
    for (const binding of manifest.bindings.templates) {
      templateBindings.set(
        `${binding.moduleId}:${binding.templateId}`,
        manifest.slug,
      );
    }
  }

  return { registry, bySlug, moduleBindings, templateBindings };
}

function readRegistry(skillsRoot: string): SkillRegistrySnapshot {
  const startedAt = performance.now();
  const raw = JSON.parse(
    readFileSync(join(skillsRoot, REGISTRY_FILENAME), "utf8"),
  );
  const snapshot = buildSnapshot(skillRegistryV1Schema.parse(raw));
  metrics.registryLoadCount += 1;
  metrics.registryLoadMs = performance.now() - startedAt;
  return snapshot;
}

export function loadSkillRegistry(
  skillsRoot = resolveSkillsRoot(),
): SkillRegistrySnapshot {
  const cached = registryCache.get(skillsRoot);
  if (cached) return cached;
  const snapshot = readRegistry(skillsRoot);
  registryCache.set(skillsRoot, snapshot);
  return snapshot;
}

/** Parse first and replace atomically so a failed refresh keeps the last snapshot. */
export function refreshSkillRegistry(
  skillsRoot = resolveSkillsRoot(),
): SkillRegistrySnapshot {
  const snapshot = readRegistry(skillsRoot);
  registryCache.set(skillsRoot, snapshot);
  return snapshot;
}

export function clearSkillRegistryCache(): void {
  registryCache.clear();
}

export function getSkillRegistryMetrics(): SkillRegistryMetrics {
  return { ...metrics };
}
