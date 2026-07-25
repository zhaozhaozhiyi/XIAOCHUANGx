import assert from "node:assert/strict";
import test from "node:test";

import {
  clearSelectedSkillBundleCache,
  composeRunPrompts,
  getSkillLoaderMetrics,
  loadSkillRegistry,
  loadSelectedSkillBundle,
  resetSkillLoaderMetrics,
  selectSkill,
} from "../packages/runtime-core/dist/index.js";

const registry = loadSkillRegistry();
function decision(overrides = {}) {
  return selectSkill({
    registry,
    decisionId: overrides.decisionId ?? "prompt-decision",
    runId: "prompt-run",
    sessionId: "prompt-session",
    decidedAt: "2026-07-24T00:00:00.000Z",
    moduleId: "chat",
    userText: "你好",
    ...overrides,
  });
}

test("normal V2 chat has no business Skill, Catalog or Agent Kit", () => {
  clearSelectedSkillBundleCache();
  resetSkillLoaderMetrics();
  const none = decision();
  const result = composeRunPrompts({
    mode: "auto",
    userText: "你好",
    orchestrationVersion: "v2",
    skillDecision: none,
  });
  assert.deepEqual(result.meta.injectedSlugs, []);
  assert.equal(result.meta.agentKitPath, null);
  assert.equal(result.meta.orchestrationMode, "companion-select-v2");
  assert.equal(result.systemPrompt.includes("<available_skills>"), false);
  assert.equal(result.systemPrompt.includes("skill-qa"), false);
  assert.equal(result.systemPrompt.includes("skill-platform-research-norms"), false);
  assert.equal(result.systemPrompt.includes("Skill Catalog"), false);
  assert.equal(getSkillLoaderMetrics().skillBodyReadCount, 0);
  assert.ok(result.systemPrompt.length < 3824);
});

test("selected V2 prompt injects only the already loaded bundle", () => {
  clearSelectedSkillBundleCache();
  resetSkillLoaderMetrics();
  const selected = decision({
    decisionId: "selected-prompt",
    requestedSkillSlug: "skill-wr-industry",
  });
  const bundle = loadSelectedSkillBundle({ decision: selected, registry });
  assert.equal(bundle.status, "ready");
  const readsBeforeCompose = getSkillLoaderMetrics().skillBodyReadCount;
  const result = composeRunPrompts({
    mode: "auto",
    userText: "做行业研究",
    orchestrationVersion: "v2",
    skillDecision: selected,
    selectedBundle: bundle,
  });
  assert.deepEqual(result.meta.injectedSlugs, ["skill-wr-industry"]);
  assert.equal(result.meta.bundleHash, bundle.bundleHash);
  assert.equal(result.systemPrompt.includes("<!-- skill:skill-wr-industry -->"), true);
  assert.equal(result.systemPrompt.includes("<available_skills>"), false);
  assert.equal(getSkillLoaderMetrics().skillBodyReadCount, readsBeforeCompose);
});

test("V2 rejects a selected Decision without a ready bundle", () => {
  assert.throws(() =>
    composeRunPrompts({
      mode: "auto",
      userText: "做行业研究",
      orchestrationVersion: "v2",
      skillDecision: decision({ requestedSkillSlug: "skill-wr-industry" }),
    }),
  );
});
