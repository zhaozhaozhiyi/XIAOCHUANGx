import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test, { after } from "node:test";

import {
  createRunRequestSchema,
  runEventSchema,
  runRecordSchema,
  skillManifestV1Schema,
  skillSelectionDecisionV1Schema,
} from "../packages/contracts/dist/index.js";

const now = "2026-07-24T00:00:00.000Z";
const hash = `sha256:${"a".repeat(64)}`;
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const evidenceDir =
  process.env.JLC_SKILL_EVIDENCE_DIR?.trim() ||
  join(repoRoot, "output", "skill-orchestration-0.1.7");
const results = [];

function decision(overrides = {}) {
  return {
    decisionVersion: 1,
    decisionId: "decision-1",
    sessionId: "session-1",
    runId: "run-1",
    decisionOutcome: "selected",
    requestedSkillSlug: "skill-wr-industry",
    primarySkillSlug: "skill-wr-industry",
    requiredSkillSlugs: [],
    selectionSource: "explicit",
    reasonCode: "explicit_structured",
    reasonText: "User selected the skill.",
    selectorVersion: "0.1.7-v1",
    decidedAt: now,
    ...overrides,
  };
}

test("SkillManifestV1 accepts a complete versioned manifest", () => {
  const parsed = skillManifestV1Schema.parse({
    manifestVersion: 1,
    slug: "skill-wr-industry",
    version: "1.0.0",
    kind: "workflow",
    scope: ["chat", "writing"],
    summary: "Industry research workflow",
    status: "active",
    selectableSources: ["explicit", "template", "intent"],
    bindings: {
      moduleIds: [],
      templates: [{ moduleId: "writing", templateId: "industry" }],
    },
    triggers: [{ id: "industry", type: "phrase", pattern: "行业研究" }],
    excludes: [],
    priority: 100,
    skillDependencies: [],
    capabilityRequirements: [],
    assetPolicy: {
      references: false,
      scripts: false,
      templates: false,
      assets: false,
    },
  });
  assert.equal(parsed.slug, "skill-wr-industry");
  results.push({
    id: "manifest-v1",
    positiveFixtures: 1,
    negativeFixtures: 0,
  });
});

test("Decision enforces selected, none and rejected invariants", () => {
  assert.equal(skillSelectionDecisionV1Schema.parse(decision()).decisionOutcome, "selected");
  assert.equal(
    skillSelectionDecisionV1Schema.parse(
      decision({
        decisionOutcome: "none",
        requestedSkillSlug: null,
        primarySkillSlug: null,
        selectionSource: "none",
        reasonCode: "no_match",
      }),
    ).decisionOutcome,
    "none",
  );
  assert.throws(() =>
    skillSelectionDecisionV1Schema.parse(
      decision({ decisionOutcome: "selected", primarySkillSlug: null }),
    ),
  );
  assert.throws(() =>
    skillSelectionDecisionV1Schema.parse(
      decision({
        decisionOutcome: "rejected",
        primarySkillSlug: null,
        requestedSkillSlug: "invalid",
        selectionSource: "intent",
        reasonCode: "explicit_invalid_format",
      }),
    ),
  );
  results.push({
    id: "decision-invariants",
    positiveFixtures: 2,
    negativeFixtures: 2,
  });
});

test("RunRecord remains backward compatible and persists a Decision", () => {
  const legacy = {
    runId: "run-1",
    tenantId: "local",
    projectId: "project-1",
    workspaceId: "workspace-1",
    sessionId: "session-1",
    turnId: "turn-1",
    agentId: "codex",
    agentModel: "default",
    status: "accepted",
    queuePolicy: "interrupt",
    createdAt: now,
  };
  assert.equal(runRecordSchema.parse(legacy).skillDecision, undefined);
  assert.equal(
    runRecordSchema.parse({ ...legacy, skillDecision: decision() }).skillDecision
      ?.decisionId,
    "decision-1",
  );
  results.push({
    id: "run-record-compatibility",
    positiveFixtures: 2,
    negativeFixtures: 0,
  });
});

test("CreateRunRequest accepts V2 facts and deprecated compatibility fields", () => {
  const parsed = createRunRequestSchema.parse({
    tenantId: "local",
    projectId: "project-1",
    workspaceId: "workspace-1",
    sessionId: "session-1",
    turnId: "turn-1",
    agentId: "codex",
    agentModel: "default",
    mode: "auto",
    queuePolicy: "interrupt",
    userMessage: { text: "Use the selected skill" },
    context: {
      moduleId: "writing",
      templateId: "industry",
      requestedSkillSlug: "skill-wr-industry",
      processSkill: "skill-writing-base",
    },
  });
  assert.equal(parsed.context?.requestedSkillSlug, "skill-wr-industry");
  results.push({
    id: "request-v2-and-legacy-fields",
    positiveFixtures: 1,
    negativeFixtures: 0,
  });
});

test("RunEvent accepts bundle events and rejects invalid hashes", () => {
  const base = {
    skillEventVersion: 1,
    eventId: "event-1",
    decisionId: "decision-1",
    runId: "run-1",
    sessionId: "session-1",
    occurredAt: now,
  };
  assert.equal(
    runEventSchema.parse({
      ...base,
      type: "skill.selected",
      primarySkillSlug: "skill-wr-industry",
      requiredSkillSlugs: [],
      selectionSource: "explicit",
      reasonCode: "explicit_structured",
      streamSeq: 1,
    }).type,
    "skill.selected",
  );
  assert.equal(
    runEventSchema.parse({
      ...base,
      type: "skill.ready",
      items: [
        {
          slug: "skill-wr-industry",
          version: "1.0.0",
          contentHash: hash,
          cacheStatus: "miss",
        },
      ],
      bundleHash: hash,
      bundleCacheStatus: "miss",
      agentKitPath: null,
    }).type,
    "skill.ready",
  );
  assert.equal(
    runEventSchema.parse({
      ...base,
      type: "skill.failed",
      failedSkillSlug: "skill-dependency",
      failureStage: "dependency",
      loadedItems: [],
      failureCode: "dependency_missing",
      failureMessage: "Dependency is missing.",
      fallbackMode: "blocked",
    }).type,
    "skill.failed",
  );
  assert.throws(() =>
    runEventSchema.parse({
      ...base,
      type: "skill.ready",
      items: [],
      bundleHash: "not-a-hash",
      bundleCacheStatus: "miss",
      agentKitPath: null,
    }),
  );
  results.push({
    id: "bundle-events",
    positiveFixtures: 3,
    negativeFixtures: 1,
  });
});

after(async () => {
  const expectedTests = 5;
  const report = {
    reportVersion: 1,
    candidateVersion: "0.1.7",
    generatedAt: new Date().toISOString(),
    tests: results,
    totals: {
      tests: results.length,
      positiveFixtures: results.reduce(
        (total, item) => total + item.positiveFixtures,
        0,
      ),
      negativeFixtures: results.reduce(
        (total, item) => total + item.negativeFixtures,
        0,
      ),
    },
    gates: {
      allContractTestsPassed: results.length === expectedTests,
      manifestSchemaCovered: results.some((item) => item.id === "manifest-v1"),
      decisionInvariantsCovered: results.some(
        (item) => item.id === "decision-invariants",
      ),
      legacyRunRecordCovered: results.some(
        (item) => item.id === "run-record-compatibility",
      ),
      requestCompatibilityCovered: results.some(
        (item) => item.id === "request-v2-and-legacy-fields",
      ),
      bundleEventsCovered: results.some((item) => item.id === "bundle-events"),
    },
  };
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    join(evidenceDir, "contracts-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
  assert.equal(results.length, expectedTests, "contract evidence is incomplete");
});
