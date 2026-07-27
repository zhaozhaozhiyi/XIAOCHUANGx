#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const evidenceDir =
  process.env.JLC_SKILL_EVIDENCE_DIR?.trim() ||
  join(repoRoot, "output", "skill-orchestration-0.1.7");

async function json(name) {
  const path = join(evidenceDir, name);
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`required release evidence is missing or invalid: ${path}`, {
      cause: error,
    });
  }
}

async function text(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    throw new Error(`required release evidence is missing: ${path}`, {
      cause: error,
    });
  }
}

function assertBooleanGates(gates, label) {
  assert(gates && typeof gates === "object", `${label}: gates missing`);
  for (const [gate, value] of Object.entries(gates)) {
    assert.equal(value, true, `${label}: gate failed: ${gate}`);
  }
}

const inventory = await json("registry-inventory.json");
assert.equal(inventory.total, 48);
assert.equal(inventory.active, 44);
assert.equal(inventory.disabled, 4);
assertBooleanGates(inventory.gates, "registry-inventory");

const contracts = await json("contracts-report.json");
assert.equal(contracts.totals.tests, 5);
assert(contracts.totals.positiveFixtures > 0);
assert(contracts.totals.negativeFixtures > 0);
assertBooleanGates(contracts.gates, "contracts-report");

const selector = await json("selector-matrix.json");
assert.equal(new Set(selector.cases.map((item) => item.id)).size, 25);
assert.equal(selector.cases.every((item) => item.passed), true);
assertBooleanGates(selector.gates, "selector-matrix");

const prompt = await json("prompt-baseline.json");
assert(prompt.candidate.promptRatioToLegacy < 0.7);
assertBooleanGates(prompt.gates, "prompt-baseline");

const io = await json("io-benchmark.json");
assert.equal(io.normalChat.skillBodyReadCount, 0);
assert.equal(io.normalChat.skillFilesystemScanCount, 0);
assert.equal(io.normalChat.agentKitCreateCount, 0);
assert.deepEqual(io.normalChat.injectedSkills, []);
assertBooleanGates(io.gates, "io-benchmark");

const qualityFixtures = await json("quality-fixture-report.json");
assert.equal(qualityFixtures.fixtureCount, 24);
assert.equal(qualityFixtures.automatedGate?.passed, true);

const quality = await json("quality-report.json");
assert.equal(quality.passed, true);
assert.equal(quality.summaries.length, 3);
assert.equal(quality.summaries.every((item) => item.passed), true);
assert.equal(quality.summaries.every((item) => item.p0ErrorCount === 0), true);

const agents = await json("real-agents-report.json");
assert.equal(agents.runMode, "cli");
assert.equal(agents.fallback, "error");
assertBooleanGates(agents.gates, "real-agents-report");

const versions = await json("release-version-report.json");
assert.equal(versions.candidateVersion, "0.1.7");
assert.equal(versions.packages.length, 8);
assertBooleanGates(versions.gates, "release-version-report");

const packaged = await json("packaged-runtime-report.json");
assert.equal(packaged.ok, true);
assert.equal(packaged.expectedVersion, "0.1.7");
assert.equal(packaged.resources.skillCount, 48);
assert.equal(packaged.resources.activeSkillCount, 44);

const installedMac = await json("installed-macos-report.json");
assert.equal(installedMac.ok, true);
assert.equal(installedMac.platform, "darwin");
assert.equal(installedMac.candidate.version, "0.1.7");
assert.equal(installedMac.isolation.realApplicationsModified, false);
assert.equal(installedMac.isolation.realUserDataPreserved, true);

const installedWindows = await json("installed-windows-report.json");
assert.equal(installedWindows.ok, true);
assert.equal(installedWindows.platform, "win32");
assert.equal(installedWindows.candidate.version, "0.1.7");
assert.match(installedWindows.candidate.installerSha256, /^[a-f0-9]{64}$/);
assert.equal(installedWindows.isolation.realUserDataPreserved, true);
assert.equal(installedWindows.upgrade.historicalMessagesPreserved, true);
assert.equal(installedWindows.upgrade.historicalRunRecordPreserved, true);
assert.equal(installedWindows.downgrade.unknownV2EventsReadableOrIgnored, true);

const moduleRegression = await text(
  join(evidenceDir, "module-regression-report.md"),
);
for (const moduleName of [
  "Chat module",
  "Writing/PPT",
  "PPT Registry",
  "3D/OpenSCAD",
  "Video routes",
  "Simulation P0",
]) {
  assert.match(
    moduleRegression,
    new RegExp(`- ${moduleName.replace("/", "\\/")}.*PASS`),
    `module regression missing PASS: ${moduleName}`,
  );
}
assert.match(moduleRegression, /No module regression remains open/);

const packageReport = await text(join(evidenceDir, "package-report.md"));
assert.doesNotMatch(packageReport, /WINDOWS (?:BLOCKED|PENDING)/i);
assert.match(packageReport, /Windows.*SHA-256/i);

const rollbackReport = await text(join(evidenceDir, "rollback-report.md"));
assert.doesNotMatch(rollbackReport, /WINDOWS (?:BLOCKED|PENDING)/i);
assert.match(rollbackReport, /Windows.*PASS/i);

const acceptanceStatus = await text(join(evidenceDir, "acceptance-status.md"));
assert.match(acceptanceStatus, /Overall: READY FOR RC/);
assert.doesNotMatch(acceptanceStatus, /Open Stop-Ship/);

const releaseNotes = await text(join(repoRoot, "docs", "release-notes", "0.1.7.md"));
assert.doesNotMatch(releaseNotes, /仍是 Stop-Ship|不得发布/);

const executionPlan = await text(
  join(repoRoot, "docs", "plans", "skill-orchestration-0.1.7-execution-plan.md"),
);
assert.match(executionPlan, /- \[x\] T07B 双平台制品、升级、降级和回滚通过/);
assert.match(executionPlan, /- \[x\] 所有 Stop-Ship 条件均为 false/);

console.log(
  "PASS 0.1.7 release evidence: Registry, contracts, selector, I/O, quality, agents, modules, macOS, Windows and rollback",
);
