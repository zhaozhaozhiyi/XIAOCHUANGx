import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runAgent } from "../packages/runtime-core/src/index.js";
import {
  appendFinalSegment,
  createFinalSegmentAccumulator,
} from "../companion/src/runs/assistant-segments.js";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const evidenceDir =
  process.env.JLC_SKILL_EVIDENCE_DIR?.trim() ||
  join(repoRoot, "output", "skill-orchestration-0.1.7");
const pairsReport = JSON.parse(
  await readFile(join(evidenceDir, "response-quality-pairs.json"), "utf8"),
);
const fixtureFile = JSON.parse(
  await readFile(
    join(repoRoot, "scripts", "fixtures", "skill-orchestration-quality.json"),
    "utf8",
  ),
);
const agents = ["codex", "claude", "hermes"];

function parseJsonObject(raw: string): unknown {
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  assert(first >= 0 && last > first, "judge did not return a JSON object");
  return JSON.parse(raw.slice(first, last + 1));
}

async function judgeAgent(agentId: string) {
  const sourcePairs = pairsReport.pairs.filter(
    (pair: { agentId: string }) => pair.agentId === agentId,
  );
  assert.equal(sourcePairs.length, 24);
  const blinded = sourcePairs.map((pair: any, index: number) => ({
    fixtureId: pair.fixtureId,
    category: pair.category,
    userText: pair.userText,
    expectedResponseMode: pair.expectedResponseMode,
    responseA: index % 2 === 0 ? pair.baseline.answer : pair.candidate.answer,
    responseB: index % 2 === 0 ? pair.candidate.answer : pair.baseline.answer,
  }));
  const prompt = [
    "You are a strict paired-response quality reviewer.",
    "The two response variants are blinded. Judge each independently; do not guess which is newer.",
    "Return exactly one JSON object and no markdown.",
    "Use one holistic integer score from 1 to 5, considering correctness, relevance, instruction following, clarification quality, and honesty.",
    "Do not reward verbosity. A concise correct response may score 5.",
    "For ambiguous requests, a necessary concise clarification is correct. For sufficiently specified requests, needless clarification is a defect.",
    `P0 definitions: ${JSON.stringify(fixtureFile.rubric.p0Errors)}.`,
    "p0A and p0B must contain only matching P0 definition identifiers, or be empty arrays.",
    "Required shape: {\"reviews\":[{\"fixtureId\":\"Q01\",\"scoreA\":5,\"scoreB\":5,\"p0A\":[],\"p0B\":[],\"notes\":\"brief evidence\"}]}",
    "Review all 24 rows exactly once:",
    JSON.stringify(blinded),
  ].join("\n\n");

  let fallbackText = "";
  let segmentText = "";
  let failure: string | null = null;
  const segments = createFinalSegmentAccumulator();
  const result = await runAgent(
    {
      agentId: "codex",
      agentModel: "default",
      cwd: evidenceDir,
      mode: "auto",
      composedPrompt: prompt,
    },
    {
      onText(chunk) {
        fallbackText += chunk;
      },
      onAssistantSegment(segment) {
        segmentText += appendFinalSegment(segments, segment);
      },
      onError(message, code) {
        failure = `${code ?? "judge_error"}: ${message}`;
      },
    },
    { timeoutMs: 300_000, idleTimeoutMs: 120_000 },
  );
  assert.equal(failure, null, failure ?? undefined);
  assert.equal(result.exitCode, 0, result.stderrTail);
  const parsed = parseJsonObject(segmentText || fallbackText) as {
    reviews: Array<{
      fixtureId: string;
      scoreA: number;
      scoreB: number;
      p0A: string[];
      p0B: string[];
      notes: string;
    }>;
  };
  assert.equal(parsed.reviews.length, 24);
  const byFixture = new Map(parsed.reviews.map((item) => [item.fixtureId, item]));
  return sourcePairs.map((pair: any, index: number) => {
    const item = byFixture.get(pair.fixtureId);
    assert(item, `missing judge result ${agentId}/${pair.fixtureId}`);
    assert(Number.isInteger(item.scoreA) && item.scoreA >= 1 && item.scoreA <= 5);
    assert(Number.isInteger(item.scoreB) && item.scoreB >= 1 && item.scoreB <= 5);
    const baselineIsA = index % 2 === 0;
    return {
      agentId,
      fixtureId: pair.fixtureId,
      baselineScore: baselineIsA ? item.scoreA : item.scoreB,
      candidateScore: baselineIsA ? item.scoreB : item.scoreA,
      baselineP0Errors: baselineIsA ? item.p0A : item.p0B,
      candidateP0Errors: baselineIsA ? item.p0B : item.p0A,
      notes: item.notes,
      blindedOrder: baselineIsA ? "baseline=A" : "baseline=B",
    };
  });
}

const reviews = [];
for (const agentId of agents) {
  console.log(`[quality-judge] ${agentId}`);
  reviews.push(...(await judgeAgent(agentId)));
}
const report = {
  reportVersion: 1,
  generatedAt: new Date().toISOString(),
  reviewMethod: "blind-paired-codex-cli",
  reviewerVersion: execFileSync("codex", ["--version"], {
    encoding: "utf8",
    timeout: 30_000,
  }).trim(),
  rubric: fixtureFile.rubric,
  reviews,
};
const outputPath = join(evidenceDir, "response-quality-review.json");
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`PASS blind review ${reviews.length}/${reviews.length}; report=${outputPath}`);
