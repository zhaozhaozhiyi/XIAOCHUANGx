import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  clearSkillCache,
  composeRunPrompts,
  getSkillLoaderMetrics,
  loadSkillRegistry,
  resetSkillLoaderMetrics,
  selectSkill,
} from "../packages/runtime-core/dist/index.js";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const fixturePath = join(
  repoRoot,
  "scripts",
  "fixtures",
  "skill-orchestration-quality.json",
);
const evidenceDir =
  process.env.JLC_SKILL_EVIDENCE_DIR?.trim() ||
  join(repoRoot, "output", "skill-orchestration-0.1.7");
const reportPath = join(evidenceDir, "quality-fixture-report.json");
const fixtureFile = JSON.parse(await readFile(fixturePath, "utf8"));
const fixtures = fixtureFile.fixtures;

assert.equal(fixtureFile.fixtureVersion, 1);
assert.equal(
  fixtureFile.scope,
  "skill-orchestration-0.1.7-normal-chat-quality",
);
assert.equal(fixtures.length, 24, "quality gate requires exactly 24 fixtures");
assert.equal(new Set(fixtures.map((item) => item.id)).size, fixtures.length);
for (const category of [
  "greeting",
  "fact",
  "concept",
  "code_error",
  "short_transform",
  "ambiguous",
  "skill_negative",
]) {
  assert(
    fixtures.some((item) => item.category === category),
    `missing quality category: ${category}`,
  );
}

const registry = loadSkillRegistry();
const results = [];
for (const [index, fixture] of fixtures.entries()) {
  clearSkillCache();
  resetSkillLoaderMetrics();
  const decision = selectSkill({
    registry,
    decisionId: `quality-decision-${fixture.id}`,
    runId: `quality-run-${fixture.id}`,
    sessionId: `quality-session-${fixture.id}`,
    decidedAt: "2026-07-24T00:00:00.000Z",
    moduleId: "chat",
    userText: fixture.userText,
  });
  const composed = composeRunPrompts({
    mode: "auto",
    userText: fixture.userText,
    orchestrationVersion: "v2",
    skillDecision: decision,
  });
  const metrics = getSkillLoaderMetrics();
  const failures = [];
  if (decision.decisionOutcome !== fixture.expectedDecisionOutcome) {
    failures.push(
      `decision=${decision.decisionOutcome}, expected=${fixture.expectedDecisionOutcome}`,
    );
  }
  if (composed.meta.injectedSlugs.length !== 0) {
    failures.push(`injected=${composed.meta.injectedSlugs.join(",")}`);
  }
  if (metrics.skillBodyReadCount !== 0) {
    failures.push(`skillBodyReadCount=${metrics.skillBodyReadCount}`);
  }
  for (const forbidden of [
    "<available_skills>",
    "Skill Catalog",
    "skill-qa",
    "skill-platform-research-norms",
  ]) {
    if (composed.systemPrompt.includes(forbidden)) {
      failures.push(`prompt contains ${forbidden}`);
    }
  }
  results.push({
    fixtureId: fixture.id,
    category: fixture.category,
    expectedResponseMode: fixture.expectedResponseMode,
    decisionOutcome: decision.decisionOutcome,
    reasonCode: decision.reasonCode,
    injectedSkills: composed.meta.injectedSlugs,
    skillBodyReadCount: metrics.skillBodyReadCount,
    systemPromptChars: composed.systemPrompt.length,
    passed: failures.length === 0,
    failures,
    sequence: index + 1,
  });
}

const failed = results.filter((result) => !result.passed);
const report = {
  reportVersion: 1,
  candidateVersion: fixtureFile.candidateVersion,
  baselineVersion: fixtureFile.baselineVersion,
  fixtureCount: fixtures.length,
  automatedGate: {
    passed: failed.length === 0,
    checks: [
      "deterministic Decision outcome",
      "zero business Skill injection",
      "zero Skill body reads",
      "no Catalog or legacy QA Skill in the V2 platform Prompt",
    ],
  },
  responseScoring: {
    status: "requires-paired-real-agent-review",
    evidence: [
      "response-quality-pairs.json",
      "response-quality-review.json",
      "quality-report.json",
      "quality-report.md",
    ],
    rubric: fixtureFile.rubric,
  },
  results,
};
await mkdir(evidenceDir, { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
assert.equal(failed.length, 0, JSON.stringify(failed, null, 2));
console.log(
  `PASS skill quality fixtures ${results.length}/${results.length}; report=${reportPath}`,
);
