import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const evidenceDir =
  process.env.JLC_SKILL_EVIDENCE_DIR?.trim() ||
  join(repoRoot, "output", "skill-orchestration-0.1.7");
const agentKitRoot = join(evidenceDir, ".baseline-agent-kit");
process.env.JLC_AGENT_KIT_DIR = agentKitRoot;

const {
  clearSkillCache,
  clearSelectedSkillBundleCache,
  composeRunPrompts,
  getAgentKitMetrics,
  getSkillLoaderMetrics,
  getSkillRegistryMetrics,
  loadSkillRegistry,
  loadSelectedSkillBundle,
  resetAgentKitMetrics,
  resetSkillLoaderMetrics,
  resolveChatOrchestration,
  selectSkill,
  stageAgentKitForRun,
} = await import("../packages/runtime-core/dist/index.js");

await mkdir(evidenceDir, { recursive: true });
clearSkillCache();
resetSkillLoaderMetrics();
resetAgentKitMetrics();
const legacyOrchestration = resolveChatOrchestration({ mode: "auto" });
const legacy = composeRunPrompts({
  mode: "auto",
  userText: "你好",
  processSkill: legacyOrchestration.baseProcessSkill,
  platformNormSkill: legacyOrchestration.platformNormSkill,
  chatCatalog: legacyOrchestration.catalog,
});
await stageAgentKitForRun({
  runId: "baseline-legacy",
  processSkill: legacyOrchestration.baseProcessSkill,
});
const legacyLoaderMetrics = getSkillLoaderMetrics();
const legacyAgentKitMetrics = getAgentKitMetrics();

clearSkillCache();
resetSkillLoaderMetrics();
resetAgentKitMetrics();
const registry = loadSkillRegistry();
const noneDecision = selectSkill({
  registry,
  decisionId: "baseline-v2-decision",
  runId: "baseline-v2-run",
  sessionId: "baseline-v2-session",
  decidedAt: "2026-07-24T00:00:00.000Z",
  moduleId: "chat",
  userText: "你好",
});
const v2 = composeRunPrompts({
  mode: "auto",
  userText: "你好",
  orchestrationVersion: "v2",
  skillDecision: noneDecision,
});
const v2LoaderMetrics = getSkillLoaderMetrics();
const v2AgentKitMetrics = getAgentKitMetrics();

const selectorSamples = [];
for (let index = 0; index < 2000; index += 1) {
  const startedAt = performance.now();
  selectSkill({
    registry,
    decisionId: `benchmark-${index}`,
    runId: `benchmark-${index}`,
    sessionId: "benchmark-session",
    decidedAt: "2026-07-24T00:00:00.000Z",
    moduleId: "chat",
    userText: index % 2 === 0 ? "你好" : "解释一下 HTTP 404",
  });
  selectorSamples.push(performance.now() - startedAt);
}
selectorSamples.sort((a, b) => a - b);
const p95 = selectorSamples[Math.ceil(selectorSamples.length * 0.95) - 1];
const promptRatio = v2.systemPrompt.length / legacy.systemPrompt.length;
const report = {
  reportVersion: 1,
  generatedFor: "0.1.7",
  fixture: "normal chat: 你好",
  legacy: {
    version: "0.1.6",
    orchestrationMode: legacy.meta.orchestrationMode,
    systemPromptChars: legacy.systemPrompt.length,
    injectedSkills: legacy.meta.injectedSlugs,
    catalogEntries: legacy.meta.catalogSlugs?.length ?? 0,
    skillBodyReadCount: legacyLoaderMetrics.skillBodyReadCount,
    skillBodyCacheHitCount: legacyLoaderMetrics.skillBodyCacheHitCount,
    agentKitCreateCount: legacyAgentKitMetrics.agentKitCreateCount,
  },
  candidate: {
    version: "0.1.7",
    orchestrationMode: v2.meta.orchestrationMode,
    decisionOutcome: noneDecision.decisionOutcome,
    systemPromptChars: v2.systemPrompt.length,
    promptRatioToLegacy: promptRatio,
    injectedSkills: v2.meta.injectedSlugs,
    catalogEntries: v2.meta.catalogSlugs?.length ?? 0,
    skillBodyReadCount: v2LoaderMetrics.skillBodyReadCount,
    agentKitCreateCount: v2AgentKitMetrics.agentKitCreateCount,
    skillFilesystemScanCount: getSkillRegistryMetrics().skillFilesystemScanCount,
    selectorAndRegistryP95Ms: p95,
    selectorSamples: selectorSamples.length,
  },
  gates: {
    promptUnder70Percent: promptRatio < 0.7,
    zeroInjectedSkills: v2.meta.injectedSlugs.length === 0,
    zeroSkillBodyReads: v2LoaderMetrics.skillBodyReadCount === 0,
    zeroAgentKitCreates: v2AgentKitMetrics.agentKitCreateCount === 0,
    zeroFilesystemScans: getSkillRegistryMetrics().skillFilesystemScanCount === 0,
    selectorP95Under20Ms: p95 <= 20,
  },
};
const reportPath = join(evidenceDir, "prompt-baseline.json");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

clearSelectedSkillBundleCache();
resetSkillLoaderMetrics();
const selectedDecision = selectSkill({
  registry,
  decisionId: "io-selected-decision",
  runId: "io-selected-run",
  sessionId: "io-selected-session",
  decidedAt: "2026-07-24T00:00:00.000Z",
  moduleId: "chat",
  userText: "用 skill-wr-industry 做行业研究",
});
const coldBundle = loadSelectedSkillBundle({
  decision: selectedDecision,
  registry,
});
const coldMetrics = getSkillLoaderMetrics();
const hotBundle = loadSelectedSkillBundle({
  decision: selectedDecision,
  registry,
});
const hotMetrics = getSkillLoaderMetrics();

clearSelectedSkillBundleCache();
const full3dDecision = selectSkill({
  registry,
  decisionId: "io-partial-decision",
  runId: "io-partial-run",
  sessionId: "io-partial-session",
  decidedAt: "2026-07-24T00:00:00.000Z",
  moduleId: "3d",
  userText: "绘制零件",
  availableCapabilities: new Set(["cad-runtime", "openscad-toolchain"]),
});
const primaryOnly3dDecision = {
  ...full3dDecision,
  decisionId: "io-primary-only-decision",
  requiredSkillSlugs: [],
};
const primaryOnlyBundle = loadSelectedSkillBundle({
  decision: primaryOnly3dDecision,
  registry,
});
resetSkillLoaderMetrics();
const partialBundle = loadSelectedSkillBundle({
  decision: full3dDecision,
  registry,
});
const partialMetrics = getSkillLoaderMetrics();

const ioReport = {
  reportVersion: 1,
  candidateVersion: "0.1.7",
  generatedAt: new Date().toISOString(),
  normalChat: {
    skillBodyReadCount: v2LoaderMetrics.skillBodyReadCount,
    skillFilesystemScanCount: getSkillRegistryMetrics().skillFilesystemScanCount,
    agentKitCreateCount: v2AgentKitMetrics.agentKitCreateCount,
    injectedSkills: v2.meta.injectedSlugs,
    selectorAndRegistryP95Ms: p95,
    selectorSamples: selectorSamples.length,
  },
  selectedColdLoad: {
    status: coldBundle.status,
    bundleCacheStatus:
      coldBundle.status === "ready" ? coldBundle.bundleCacheStatus : null,
    skillBodyReadCount: coldMetrics.skillBodyReadCount,
  },
  selectedFullMemoryHit: {
    status: hotBundle.status,
    bundleCacheStatus:
      hotBundle.status === "ready" ? hotBundle.bundleCacheStatus : null,
    bundleHashStable:
      coldBundle.status === "ready" &&
      hotBundle.status === "ready" &&
      coldBundle.bundleHash === hotBundle.bundleHash,
    cumulativeSkillBodyReadCount: hotMetrics.skillBodyReadCount,
  },
  selectedPartialMemoryHit: {
    warmupStatus: primaryOnlyBundle.status,
    status: partialBundle.status,
    bundleCacheStatus:
      partialBundle.status === "ready" ? partialBundle.bundleCacheStatus : null,
    skillBodyReadCount: partialMetrics.skillBodyReadCount,
  },
  gates: {
    normalChatZeroBodyReads: v2LoaderMetrics.skillBodyReadCount === 0,
    normalChatZeroFilesystemScans:
      getSkillRegistryMetrics().skillFilesystemScanCount === 0,
    normalChatZeroAgentKitCreates: v2AgentKitMetrics.agentKitCreateCount === 0,
    normalChatZeroInjectedSkills: v2.meta.injectedSlugs.length === 0,
    selectorP95Under20Ms: p95 <= 20,
    coldLoadMiss:
      coldBundle.status === "ready" && coldBundle.bundleCacheStatus === "miss",
    fullMemoryHitDoesNotReadAgain:
      hotBundle.status === "ready" &&
      hotBundle.bundleCacheStatus === "full-hit" &&
      hotMetrics.skillBodyReadCount === coldMetrics.skillBodyReadCount,
    partialMemoryHitReadsOnlyMissingItems:
      partialBundle.status === "ready" &&
      partialBundle.bundleCacheStatus === "partial-hit" &&
      partialMetrics.skillBodyReadCount === 2,
  },
};
const ioReportPath = join(evidenceDir, "io-benchmark.json");
await writeFile(ioReportPath, `${JSON.stringify(ioReport, null, 2)}\n`, "utf8");
await rm(agentKitRoot, { recursive: true, force: true });

assert.equal(noneDecision.decisionOutcome, "none");
assert(legacy.meta.injectedSlugs.length >= 2);
assert(legacy.meta.catalogSlugs?.length > 0);
for (const [gate, passed] of Object.entries(report.gates)) {
  assert.equal(passed, true, `baseline gate failed: ${gate}`);
}
for (const [gate, passed] of Object.entries(ioReport.gates)) {
  assert.equal(passed, true, `I/O gate failed: ${gate}`);
}
console.log(
  `PASS prompt baseline legacy=${legacy.systemPrompt.length} v2=${v2.systemPrompt.length} ratio=${promptRatio.toFixed(3)} p95=${p95.toFixed(3)}ms; report=${reportPath}`,
);
