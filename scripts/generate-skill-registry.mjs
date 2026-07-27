import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { skillRegistryV1Schema } from "../packages/contracts/dist/index.js";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const skillsRoot = join(repoRoot, "skills");
const policyPath = join(skillsRoot, "skill-selection-policy.json");
const registryPath = join(skillsRoot, "skill-registry.generated.json");
const inventoryPath = join(skillsRoot, "skill-registry.inventory.json");
const evidenceDir =
  process.env.JLC_SKILL_EVIDENCE_DIR?.trim() ||
  join(repoRoot, "output", "skill-orchestration-0.1.7");
const checkOnly = process.argv.includes("--check");

function parseValue(raw) {
  const value = raw.trim();
  if (
    value.startsWith("[") ||
    value.startsWith("{") ||
    value.startsWith('"')
  ) {
    return JSON.parse(value);
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function parseFrontmatter(path) {
  const raw = readFileSync(path, "utf8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert(match, `${path}: missing YAML frontmatter`);
  const values = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line || /^\s/.test(line)) continue;
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim();
    values[key] = parseValue(line.slice(colon + 1));
  }
  return values;
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function assertUnique(values, label) {
  const seen = new Set();
  for (const value of values) {
    assert(!seen.has(value), `duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

const policy = JSON.parse(readFileSync(policyPath, "utf8"));
assert.equal(policy.policyVersion, "0.1.7-v1", "unsupported policyVersion");
assert.equal(policy.registryVersion, "0.1.7-v1", "unsupported registryVersion");
assert.equal(policy.selectorVersion, "0.1.7-v1", "unsupported selectorVersion");
assert(Array.isArray(policy.skills), "selection policy skills must be an array");
assertUnique(
  policy.skills.map((item) => item.slug),
  "selection policy slug",
);
const policyBySlug = new Map(policy.skills.map((item) => [item.slug, item]));

const skillDirs = readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith("skill-"))
  .filter((entry) => existsSync(join(skillsRoot, entry.name, "SKILL.md")))
  .map((entry) => entry.name)
  .sort();

const manifests = [];
for (const directorySlug of skillDirs) {
  const frontmatter = parseFrontmatter(
    join(skillsRoot, directorySlug, "SKILL.md"),
  );
  assert.equal(
    frontmatter.slug,
    directorySlug,
    `${directorySlug}: directory and frontmatter slug differ`,
  );
  const selection = policyBySlug.get(directorySlug);
  assert(selection, `${directorySlug}: missing selection policy`);

  const manifest = {
    manifestVersion: 1,
    slug: directorySlug,
    version: frontmatter.version,
    kind: frontmatter.kind,
    scope: frontmatter.scope,
    summary: frontmatter.summary,
    status: selection.status,
    selectableSources: selection.selectableSources,
    bindings: selection.bindings,
    triggers: selection.triggers,
    excludes: selection.excludes,
    priority: selection.priority,
    skillDependencies: frontmatter.skillDependencies,
    capabilityRequirements: frontmatter.capabilityRequirements,
    assetPolicy: frontmatter.assetPolicy,
  };
  manifests.push(manifest);
}

assertUnique(manifests.map((manifest) => manifest.slug), "manifest slug");
for (const selection of policy.skills) {
  assert(
    skillDirs.includes(selection.slug),
    `${selection.slug}: policy points to a missing Skill directory`,
  );
  if (selection.status === "disabled") {
    assert.equal(
      selection.selectableSources.length,
      0,
      `${selection.slug}: disabled Skill cannot be selectable`,
    );
    assert.equal(
      selection.bindings.moduleIds.length + selection.bindings.templates.length,
      0,
      `${selection.slug}: disabled Skill cannot have bindings`,
    );
    assert.equal(
      selection.triggers.length,
      0,
      `${selection.slug}: disabled Skill cannot have triggers`,
    );
  }
}

const manifestBySlug = new Map(manifests.map((manifest) => [manifest.slug, manifest]));
const bindingKeys = [];
for (const manifest of manifests) {
  for (const moduleId of manifest.bindings.moduleIds) {
    bindingKeys.push(`module:${moduleId}`);
  }
  for (const binding of manifest.bindings.templates) {
    bindingKeys.push(`template:${binding.moduleId}:${binding.templateId}`);
  }
  for (const dependency of manifest.skillDependencies) {
    assert(
      manifestBySlug.has(dependency),
      `${manifest.slug}: unknown dependency ${dependency}`,
    );
    assert.notEqual(
      manifestBySlug.get(dependency).status,
      "disabled",
      `${manifest.slug}: dependency ${dependency} is disabled`,
    );
  }
  for (const [assetType, required] of Object.entries(manifest.assetPolicy)) {
    const assetDir = join(skillsRoot, manifest.slug, assetType);
    assert.equal(
      existsSync(assetDir),
      required,
      `${manifest.slug}: assetPolicy.${assetType} differs from the filesystem`,
    );
  }
}
assertUnique(bindingKeys, "module/template binding");

const visiting = new Set();
const visited = new Set();
function visit(slug, path = []) {
  assert(!visiting.has(slug), `dependency cycle: ${[...path, slug].join(" -> ")}`);
  if (visited.has(slug)) return;
  visiting.add(slug);
  for (const dependency of manifestBySlug.get(slug).skillDependencies) {
    visit(dependency, [...path, slug]);
  }
  visiting.delete(slug);
  visited.add(slug);
}
for (const manifest of manifests) visit(manifest.slug);

const registry = skillRegistryV1Schema.parse({
  registryVersion: policy.registryVersion,
  selectorVersion: policy.selectorVersion,
  generatedAt: policy.updatedAt,
  skills: manifests,
});

const inventory = {
  inventoryVersion: "0.1.7-v1",
  generatedAt: policy.updatedAt,
  total: manifests.length,
  active: manifests.filter((manifest) => manifest.status === "active").length,
  disabled: manifests.filter((manifest) => manifest.status === "disabled").length,
  entries: manifests.map((manifest) => ({
    directory: manifest.slug,
    slug: manifest.slug,
    version: manifest.version,
    kind: manifest.kind,
    scope: manifest.scope,
    status: manifest.status,
    bindings: manifest.bindings,
    dependencies: manifest.skillDependencies,
    capabilityRequirements: manifest.capabilityRequirements,
    assetPolicy: manifest.assetPolicy,
  })),
};

if (checkOnly) {
  assert(existsSync(registryPath), "generated Registry is missing");
  assert(existsSync(inventoryPath), "generated inventory is missing");
  assert.equal(
    readFileSync(registryPath, "utf8"),
    stableJson(registry),
    "generated Registry is stale; run pnpm skills:generate",
  );
  assert.equal(
    readFileSync(inventoryPath, "utf8"),
    stableJson(inventory),
    "generated inventory is stale; run pnpm skills:generate",
  );
} else {
  writeFileSync(registryPath, stableJson(registry));
  writeFileSync(inventoryPath, stableJson(inventory));
}

mkdirSync(evidenceDir, { recursive: true });
writeFileSync(
  join(evidenceDir, "registry-inventory.json"),
  stableJson({
    ...inventory,
    registryVersion: registry.registryVersion,
    selectorVersion: registry.selectorVersion,
    gates: {
      completeInventory: inventory.total === 48,
      expectedActiveCount: inventory.active === 44,
      expectedDisabledCount: inventory.disabled === 4,
      uniqueSlugs: new Set(inventory.entries.map((entry) => entry.slug)).size === 48,
      dependencyGraphAcyclic: visited.size === manifests.length,
      generatedRegistryCurrent: true,
    },
  }),
);

console.log(
  `ok registry ${inventory.total} skills (${inventory.active} active, ${inventory.disabled} disabled)`,
);
