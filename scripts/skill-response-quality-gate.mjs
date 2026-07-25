import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  composeAgentRunPayload,
  loadSkillRegistry,
  selectSkill,
} from "../packages/runtime-core/dist/index.js";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const evidenceDir =
  process.env.JLC_SKILL_EVIDENCE_DIR?.trim() ||
  join(repoRoot, "output", "skill-orchestration-0.1.7");
const fixtureFile = JSON.parse(
  await readFile(
    join(repoRoot, "scripts", "fixtures", "skill-orchestration-quality.json"),
    "utf8",
  ),
);
const pairs = JSON.parse(
  await readFile(join(evidenceDir, "response-quality-pairs.json"), "utf8"),
);
const review = JSON.parse(
  await readFile(join(evidenceDir, "response-quality-review.json"), "utf8"),
);
const thresholds = fixtureFile.rubric.thresholds;
const agents = ["codex", "claude", "hermes"];
const summaries = [];
const registry = loadSkillRegistry();

function expectedCandidateInstructionHash(pair) {
  const decision = selectSkill({
    registry,
    decisionId: `quality-${pair.agentId}-${pair.fixtureId}`,
    runId: `quality-${pair.agentId}-${pair.fixtureId}`,
    sessionId: `quality-${pair.agentId}-${pair.fixtureId}`,
    decidedAt: "2026-07-24T00:00:00.000Z",
    moduleId: "chat",
    userText: pair.userText,
  });
  const payload = composeAgentRunPayload({
    mode: "auto",
    userText: pair.userText,
    messages: [{ role: "user", content: pair.userText }],
    orchestrationVersion: "v2",
    skillDecision: decision,
    agentId: pair.agentId,
    cwd: repoRoot,
  });
  return `sha256:${createHash("sha256")
    .update(payload.instructionPrompt)
    .digest("hex")}`;
}

for (const agentId of agents) {
  const agentPairs = pairs.pairs.filter((item) => item.agentId === agentId);
  const agentReviews = review.reviews.filter((item) => item.agentId === agentId);
  assert.equal(agentPairs.length, 24, `${agentId}: pair count`);
  assert.equal(agentReviews.length, 24, `${agentId}: review count`);
  const reviewByFixture = new Map(
    agentReviews.map((item) => [item.fixtureId, item]),
  );
  const rows = agentPairs.map((pair) => {
    const scored = reviewByFixture.get(pair.fixtureId);
    assert(scored, `${agentId}/${pair.fixtureId}: missing score`);
    return {
      fixtureId: pair.fixtureId,
      baselineScore: scored.baselineScore,
      candidateScore: scored.candidateScore,
      delta: scored.candidateScore - scored.baselineScore,
      baselineP0Errors: scored.baselineP0Errors,
      candidateP0Errors: scored.candidateP0Errors,
      notes: scored.notes,
    };
  });
  const baselineMean =
    rows.reduce((sum, item) => sum + item.baselineScore, 0) / rows.length;
  const candidateMean =
    rows.reduce((sum, item) => sum + item.candidateScore, 0) / rows.length;
  const p0ErrorCount = rows.reduce(
    (sum, item) => sum + item.candidateP0Errors.length,
    0,
  );
  const onePointRegressionCount = rows.filter((item) => item.delta <= -1).length;
  const onePointRegressionRatio = onePointRegressionCount / rows.length;
  const baselineCompletedCount = agentPairs.filter(
    (item) => item.baseline.status === "completed",
  ).length;
  const candidateRunsCompleted = agentPairs.every(
    (item) => item.candidate.status === "completed",
  );
  const candidateOrchestrationValid = agentPairs.every(
    (item) =>
      item.candidate.prompt.decisionOutcome === "none" &&
      item.candidate.prompt.injectedSkills.length === 0 &&
      item.candidate.prompt.catalogEntries === 0,
  );
  const candidatePromptCurrent = agentPairs.every(
    (item) =>
      item.candidate.prompt.instructionHash ===
      expectedCandidateInstructionHash(item),
  );
  const gates = {
    candidateRunsCompleted,
    candidateOrchestrationValid,
    candidatePromptCurrent,
    p0ErrorCount: p0ErrorCount <= thresholds.p0ErrorCount,
    meanRegression: baselineMean - candidateMean <= thresholds.maximumMeanRegression,
    onePointRegressionRatio:
      onePointRegressionRatio <= thresholds.maximumOnePointRegressionRatio,
  };
  summaries.push({
    agentId,
    agentVersion: agentPairs[0].agentVersion,
    agentModel: agentPairs[0].agentModel,
    baselineMean,
    candidateMean,
    meanRegression: baselineMean - candidateMean,
    p0ErrorCount,
    onePointRegressionCount,
    onePointRegressionRatio,
    baselineCompletedCount,
    candidateCompletedCount: agentPairs.filter(
      (item) => item.candidate.status === "completed",
    ).length,
    gates,
    passed: Object.values(gates).every(Boolean),
    rows,
  });
}

const report = {
  reportVersion: 1,
  baselineVersion: pairs.baselineVersion,
  candidateVersion: pairs.candidateVersion,
  generatedAt: new Date().toISOString(),
  reviewMethod: review.reviewMethod,
  reviewerVersion: review.reviewerVersion,
  thresholds,
  summaries,
  passed: summaries.every((item) => item.passed),
};
const jsonPath = join(evidenceDir, "quality-report.json");
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
const markdown = [
  "# 0.1.7 Response Quality Report",
  "",
  `Paired samples: ${pairs.pairs.length}; review: ${review.reviewMethod} (${review.reviewerVersion})`,
  "",
  "| Agent | Baseline | Candidate | Regression | P0 | >=1 regression | Result |",
  "|---|---:|---:|---:|---:|---:|---|",
  ...summaries.map(
    (item) =>
      `| ${item.agentId} | ${item.baselineMean.toFixed(2)} | ${item.candidateMean.toFixed(2)} | ${item.meanRegression.toFixed(2)} | ${item.p0ErrorCount} | ${(item.onePointRegressionRatio * 100).toFixed(1)}% | ${item.passed ? "PASS" : "FAIL"} |`,
  ),
  "",
  ...summaries.flatMap((item) => {
    const regressions = item.rows.filter(
      (row) => row.delta <= -1 || row.candidateP0Errors.length > 0,
    );
    if (regressions.length === 0) return [`## ${item.agentId}`, "", "No material regressions.", ""];
    return [
      `## ${item.agentId}`,
      "",
      ...regressions.map(
        (row) =>
          `- ${row.fixtureId}: ${row.baselineScore} -> ${row.candidateScore}; P0=${row.candidateP0Errors.join(",") || "none"}; ${row.notes}`,
      ),
      "",
    ];
  }),
].join("\n");
await writeFile(join(evidenceDir, "quality-report.md"), `${markdown}\n`, "utf8");
assert.equal(report.passed, true, JSON.stringify(summaries, null, 2));
console.log(`PASS response quality ${summaries.length}/${summaries.length}; report=${jsonPath}`);
