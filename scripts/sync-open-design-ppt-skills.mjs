#!/usr/bin/env node
/**
 * 从 Open Design 参考仓库批量同步 PPT / Deck 类 Skill 到金联创 skills/ 目录。
 *
 * 用法:
 *   node scripts/sync-open-design-ppt-skills.mjs [--dry-run] [--force]
 *
 * 清单: skills/ppt-sync-manifest.json
 */
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SKILLS_ROOT = join(REPO_ROOT, "skills");
const MANIFEST_PATH = join(SKILLS_ROOT, "ppt-sync-manifest.json");

const ASSET_DIRS = new Set([
  "references",
  "templates",
  "assets",
  "scripts",
  "examples",
]);

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");

function parseFrontmatter(raw) {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("---")) return { meta: {}, body: raw.trim() };
  const end = trimmed.indexOf("---", 3);
  if (end === -1) return { meta: {}, body: raw.trim() };
  const yaml = trimmed.slice(3, end).trim();
  const body = trimmed.slice(end + 3).trim();
  const meta = {};
  for (const line of yaml.split("\n")) {
    const m = line.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (m) meta[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return { meta, body };
}

function buildJlcFrontmatter(entry, odMeta) {
  const lines = [
    "---",
    `slug: ${entry.jlcSlug}`,
    "module: ppt",
    'version: "1.0"',
    `source: open-design/${entry.source}/${entry.odSlug}`,
  ];
  if (entry.templateId) {
    lines.push(`templateId: ${entry.templateId}`);
    lines.push(`label: ${entry.label ?? entry.templateId}`);
  }
  if (entry.templatePackId) {
    lines.push(`templatePackId: ${entry.templatePackId}`);
  }
  if (entry.utility) {
    lines.push("role: utility");
  }
  if (odMeta.description) {
    lines.push(`description: ${JSON.stringify(odMeta.description)}`);
  }
  lines.push("---");
  return lines.join("\n");
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function copyTree(src, dest, { skip = new Set() } = {}) {
  const entries = await readdir(src, { withFileTypes: true });
  await mkdir(dest, { recursive: true });
  for (const ent of entries) {
    if (skip.has(ent.name)) continue;
    const from = join(src, ent.name);
    const to = join(dest, ent.name);
    if (ent.isDirectory()) {
      await copyTree(from, to, { skip });
    } else if (ent.isFile()) {
      await cp(from, to);
    }
  }
}

async function syncEntry(manifest, entry) {
  const odRoot = join(REPO_ROOT, manifest.openDesignRoot);
  const srcDir = join(odRoot, entry.source, entry.odSlug);
  const destDir = join(SKILLS_ROOT, entry.jlcSlug);
  const srcSkill = join(srcDir, "SKILL.md");

  if (!(await exists(srcSkill))) {
    throw new Error(`Missing source SKILL.md: ${srcSkill}`);
  }

  if ((await exists(destDir)) && !force) {
    console.log(`  skip ${entry.jlcSlug} (exists, use --force)`);
    return { status: "skipped" };
  }

  const raw = await readFile(srcSkill, "utf8");
  const { meta: odMeta, body } = parseFrontmatter(raw);
  const skillMd = `${buildJlcFrontmatter(entry, odMeta)}\n\n${body}\n`;

  if (dryRun) {
    console.log(`  would sync ${entry.odSlug} → ${entry.jlcSlug}`);
    return { status: "dry-run" };
  }

  if (await exists(destDir)) {
    await rm(destDir, { recursive: true, force: true });
  }
  await mkdir(destDir, { recursive: true });

  const skip = new Set(["SKILL.md"]);
  await copyTree(srcDir, destDir, { skip });
  await writeFile(join(destDir, "SKILL.md"), skillMd, "utf8");

  const rel = relative(REPO_ROOT, destDir);
  console.log(`  synced ${entry.jlcSlug} ← ${entry.source}/${entry.odSlug} (${rel})`);
  return { status: "synced" };
}

async function writeRegistrySnippet(manifest, templateEntries) {
  const lines = templateEntries
    .filter((e) => e.templateId)
    .map(
      (e) =>
        `  ${JSON.stringify(e.templateId)}: ${JSON.stringify(e.jlcSlug)}, // ${e.label ?? e.templateId}`,
    );
  const utilityEntries = manifest.entries.filter((e) => e.utility);

  const doc = [
    "# PPT Skill 注册表（由 sync-open-design-ppt-skills 生成，勿手改）",
    "",
    `生成时间: ${new Date().toISOString()}`,
    "",
    "## 路演模板 → 流程 Skill",
    "",
    "```typescript",
    "export const PPT_TEMPLATE_SKILL: Record<string, string> = {",
    ...lines,
    "};",
    "```",
    "",
    "## 工具类 Skill（不绑模板，由 skill-ppt-deck 引用）",
    "",
    ...utilityEntries.map((e) => `- \`${e.jlcSlug}\` — ${e.label ?? e.odSlug}`),
    "",
  ].join("\n");

  const outPath = join(SKILLS_ROOT, "ppt-registry.generated.md");
  if (!dryRun) {
    await writeFile(outPath, doc, "utf8");
    console.log(`\nWrote ${relative(REPO_ROOT, outPath)}`);
  }
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  console.log(
    `Open Design PPT sync (${manifest.entries.length} entries)${dryRun ? " [dry-run]" : ""}${force ? " [force]" : ""}`,
  );

  const stats = { synced: 0, skipped: 0, failed: 0 };
  for (const entry of manifest.entries) {
    try {
      const result = await syncEntry(manifest, entry);
      if (result.status === "synced") stats.synced += 1;
      else if (result.status === "skipped") stats.skipped += 1;
    } catch (err) {
      stats.failed += 1;
      console.error(`  FAIL ${entry.jlcSlug}: ${err.message}`);
    }
  }

  await writeRegistrySnippet(manifest, manifest.entries);
  console.log(
    `\nDone: synced=${stats.synced} skipped=${stats.skipped} failed=${stats.failed}`,
  );
  if (stats.failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
