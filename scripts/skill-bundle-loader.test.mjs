import assert from "node:assert/strict";
import test from "node:test";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  clearSelectedSkillBundleCache,
  getAgentKitMetrics,
  getSkillLoaderMetrics,
  loadSkillRegistry,
  loadSelectedSkillBundle,
  resetAgentKitMetrics,
  resetSkillLoaderMetrics,
  selectSkill,
  stageAgentKitForSelectedBundle,
} from "../packages/runtime-core/dist/index.js";

const registry = loadSkillRegistry();
let sequence = 0;

function decision(overrides = {}) {
  sequence += 1;
  return selectSkill({
    registry,
    decisionId: `bundle-decision-${sequence}`,
    runId: `bundle-run-${sequence}`,
    sessionId: "bundle-session",
    decidedAt: "2026-07-24T00:00:00.000Z",
    moduleId: "chat",
    userText: "用 skill-wr-industry 做行业研究",
    ...overrides,
  });
}

test("AC-19 cold load and full memory hit have stable hashes", () => {
  clearSelectedSkillBundleCache();
  resetSkillLoaderMetrics();
  const selected = decision();
  const cold = loadSelectedSkillBundle({ decision: selected, registry });
  const hot = loadSelectedSkillBundle({ decision: selected, registry });
  assert.equal(cold.status, "ready");
  assert.equal(hot.status, "ready");
  assert.equal(cold.bundleCacheStatus, "miss");
  assert.equal(hot.bundleCacheStatus, "full-hit");
  assert.equal(cold.bundleHash, hot.bundleHash);
  assert.equal(getSkillLoaderMetrics().skillBodyReadCount, 1);
});

test("AC-20 partially warm bundle only reads missing items", () => {
  clearSelectedSkillBundleCache();
  resetSkillLoaderMetrics();
  const fullDecision = decision({ moduleId: "3d", userText: "绘制零件" });
  const primaryOnly = {
    ...fullDecision,
    decisionId: "primary-only",
    requiredSkillSlugs: [],
  };
  assert.equal(
    loadSelectedSkillBundle({ decision: primaryOnly, registry }).status,
    "ready",
  );
  resetSkillLoaderMetrics();
  const partial = loadSelectedSkillBundle({ decision: fullDecision, registry });
  assert.equal(partial.status, "ready");
  assert.equal(partial.bundleCacheStatus, "partial-hit");
  assert.equal(getSkillLoaderMetrics().skillBodyReadCount, 2);
});

test("AC-18 missing required dependency never produces a ready bundle", async () => {
  clearSelectedSkillBundleCache();
  const fixtureRoot = await mkdtemp(join(tmpdir(), "jlc-skill-bundle-"));
  try {
    await cp(
      "skills/skill-simulation-base",
      join(fixtureRoot, "skill-simulation-base"),
      { recursive: true },
    );
    const selected = decision({
      moduleId: "simulation",
      userText: "推演市场变化",
    });
    const result = loadSelectedSkillBundle({
      decision: selected,
      registry,
      skillsRoot: fixtureRoot,
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failedSkillSlug, "skill-world-model");
    assert.equal(result.failureStage, "dependency");
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("AC-01 no-asset selected bundle does not create an Agent Kit", async () => {
  clearSelectedSkillBundleCache();
  resetAgentKitMetrics();
  const selected = decision();
  const bundle = loadSelectedSkillBundle({ decision: selected, registry });
  assert.equal(bundle.status, "ready");
  const staged = await stageAgentKitForSelectedBundle({
    runId: "no-assets",
    bundle,
  });
  assert.equal(staged, null);
  assert.equal(getAgentKitMetrics().agentKitCreateCount, 0);
});

test("bundle cancellation is not reported as failed or ready", () => {
  const controller = new AbortController();
  controller.abort();
  const result = loadSelectedSkillBundle({
    decision: decision(),
    registry,
    signal: controller.signal,
  });
  assert.equal(result.status, "cancelled");
});
