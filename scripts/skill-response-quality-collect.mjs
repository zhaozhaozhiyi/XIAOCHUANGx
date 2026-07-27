import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const evidenceDir =
  process.env.JLC_SKILL_EVIDENCE_DIR?.trim() ||
  join(repoRoot, "output", "skill-orchestration-0.1.7");
const rawDir = join(evidenceDir, "quality-raw");
const agents = ["codex", "claude", "hermes"];
const variants = ["legacy", "candidate"];
const cliArgs = new Set(process.argv.slice(2));
const resume = cliArgs.has("--resume");
const refreshCandidate = cliArgs.has("--refresh-candidate");
const collectOnly = cliArgs.has("--collect-only");
const concurrencyArg = process.argv
  .slice(2)
  .find((item) => item.startsWith("--concurrency="));
const concurrencyOverride = concurrencyArg
  ? Number(concurrencyArg.slice("--concurrency=".length))
  : null;
assert(
  concurrencyOverride === null ||
    (Number.isInteger(concurrencyOverride) &&
      concurrencyOverride >= 1 &&
      concurrencyOverride <= 4),
  "concurrency must be an integer from 1 to 4",
);
function selectedValues(name, allowed) {
  const prefix = `--${name}=`;
  const raw = process.argv.slice(2).find((item) => item.startsWith(prefix));
  if (!raw) return allowed;
  const values = raw
    .slice(prefix.length)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  assert(values.length > 0, `${name} cannot be empty`);
  for (const value of values) {
    assert(allowed.includes(value), `invalid ${name} value: ${value}`);
  }
  return [...new Set(values)];
}
const runAgents = selectedValues("agents", agents);
const runVariants = selectedValues("variants", variants);
await mkdir(rawDir, { recursive: true });

function normalizeAgentVersion(value) {
  return String(value)
    .split("\n")
    .filter((line) => !/^Update available:/i.test(line.trim()))
    .join("\n");
}

function runWorker(variant, agentId) {
  const output = join(rawDir, `${variant}-${agentId}.json`);
  const concurrency =
    concurrencyOverride ?? (agentId === "codex" ? 2 : 1);
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      [
        "-C",
        "companion",
        "exec",
        "tsx",
        "../scripts/skill-response-quality-worker.mts",
        `--variant=${variant}`,
        `--agent=${agentId}`,
        `--output=${output}`,
        `--concurrency=${concurrency}`,
        "--halt-on-failure=true",
        `--resume=${resume && !(refreshCandidate && variant === "candidate")}`,
        `--retry-failed=${resume}`,
      ],
      { cwd: repoRoot, env: { ...process.env }, stdio: "inherit" },
    );
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${variant}/${agentId} failed: code=${code} signal=${signal}`));
    });
  });
}

if (!collectOnly) {
  for (const variant of runVariants) {
    await Promise.all(runAgents.map((agentId) => runWorker(variant, agentId)));
  }
}

const reports = new Map();
for (const variant of variants) {
  for (const agentId of agents) {
    const path = join(rawDir, `${variant}-${agentId}.json`);
    reports.set(`${variant}:${agentId}`, JSON.parse(await readFile(path, "utf8")));
  }
}

const pairs = [];
for (const agentId of agents) {
  const baseline = reports.get(`legacy:${agentId}`);
  const candidate = reports.get(`candidate:${agentId}`);
  const agentVersion = normalizeAgentVersion(baseline.agentVersion);
  assert.equal(
    agentVersion,
    normalizeAgentVersion(candidate.agentVersion),
    `${agentId}: agent version changed`,
  );
  assert.equal(baseline.agentModel, candidate.agentModel);
  assert.equal(baseline.results.length, 24);
  assert.equal(candidate.results.length, 24);
  for (let index = 0; index < baseline.results.length; index += 1) {
    const legacyResult = baseline.results[index];
    const candidateResult = candidate.results[index];
    assert.equal(legacyResult.fixtureId, candidateResult.fixtureId);
    assert.equal(legacyResult.userText, candidateResult.userText);
    pairs.push({
      agentId,
      agentVersion,
      agentModel: baseline.agentModel,
      fixtureId: legacyResult.fixtureId,
      category: legacyResult.category,
      userText: legacyResult.userText,
      expectedResponseMode: legacyResult.expectedResponseMode,
      baseline: legacyResult,
      candidate: candidateResult,
    });
  }
}

const report = {
  reportVersion: 1,
  baselineVersion: "0.1.6",
  candidateVersion: "0.1.7",
  generatedAt: new Date().toISOString(),
  pairing: "same agent version, model, cwd, module, mode, input, and single-turn context",
  pairs,
};
const reportPath = join(evidenceDir, "response-quality-pairs.json");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`PASS response collection ${pairs.length}/${pairs.length}; report=${reportPath}`);
