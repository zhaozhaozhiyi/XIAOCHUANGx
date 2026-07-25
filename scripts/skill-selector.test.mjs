import assert from "node:assert/strict";
import test from "node:test";

import {
  clearSkillRegistryCache,
  loadSkillRegistry,
  selectSkill,
} from "../packages/runtime-core/dist/index.js";

clearSkillRegistryCache();
const registry = loadSkillRegistry();
let sequence = 0;

function decide(overrides = {}) {
  sequence += 1;
  return selectSkill({
    registry,
    decisionId: `decision-${sequence}`,
    runId: `run-${sequence}`,
    sessionId: "session-1",
    decidedAt: "2026-07-24T00:00:00.000Z",
    moduleId: "chat",
    userText: "你好",
    ...overrides,
  });
}

test("AC-01/02 normal chat selects none", () => {
  assert.equal(decide({ userText: "你好" }).decisionOutcome, "none");
  assert.equal(
    decide({ userText: "解释一下这段报错" }).decisionOutcome,
    "none",
  );
});

test("AC-03/04 structured and action+slug explicit requests select", () => {
  const structured = decide({ requestedSkillSlug: "skill-wr-industry" });
  assert.deepEqual(
    [structured.decisionOutcome, structured.selectionSource, structured.primarySkillSlug],
    ["selected", "explicit", "skill-wr-industry"],
  );
  const text = decide({ userText: "用 skill-wr-industry 做行业研究" });
  assert.deepEqual(
    [text.decisionOutcome, text.selectionSource, text.primarySkillSlug],
    ["selected", "explicit", "skill-wr-industry"],
  );
});

test("AC-05/06 references, code, URLs and logs do not select", () => {
  for (const userText of [
    "skill-wr-industry 是什么？",
    "`用 skill-wr-industry` 这段代码是什么意思",
    "https://example.com/skill-wr-industry",
    "ERROR: use skill-wr-industry failed",
    "```text\n用 skill-wr-industry\n```\n解释日志",
  ]) {
    assert.equal(decide({ userText }).decisionOutcome, "none", userText);
  }
});

test("AC-07 invalid, unknown and disabled explicit requests are rejected", () => {
  assert.equal(
    decide({ requestedSkillSlug: "not valid" }).reasonCode,
    "explicit_invalid_format",
  );
  assert.equal(
    decide({ userText: "使用 skill-does-not-exist" }).reasonCode,
    "explicit_not_found",
  );
  assert.equal(
    decide({ requestedSkillSlug: "skill-qa" }).reasonCode,
    "explicit_disabled",
  );
});

test("AC-08/09 template and module facts are deterministic", () => {
  const writing = decide({
    moduleId: "writing",
    templateId: "industry",
    userText: "生成报告",
  });
  assert.deepEqual(
    [writing.selectionSource, writing.primarySkillSlug],
    ["template", "skill-wr-industry"],
  );
  const ppt = decide({ moduleId: "ppt", userText: "生成 PPT" });
  assert.deepEqual(
    [ppt.selectionSource, ppt.primarySkillSlug],
    ["module", "skill-ppt-base"],
  );
});

test("AC-10 non-chat module binding is not overridden by natural language intent", () => {
  const result = decide({
    moduleId: "ppt",
    userText: "请整篇翻译这份文档",
  });
  assert.equal(result.primarySkillSlug, "skill-ppt-base");
  assert.equal(result.selectionSource, "module");
});

test("AC-11/12 only the unique document-translation rule matches", () => {
  const translated = decide({ userText: "请把这份文档全文翻译成英文" });
  assert.deepEqual(
    [translated.selectionSource, translated.primarySkillSlug],
    ["intent", "skill-tr-doc"],
  );
  assert.equal(decide({ userText: "帮我处理一下" }).decisionOutcome, "none");
});

test("AC-13 conflicting intent rules return none", () => {
  const original = registry.registry.skills.find(
    (item) => item.slug === "skill-tr-text",
  );
  const conflict = {
    ...original,
    selectableSources: [...original.selectableSources, "intent"],
    triggers: [
      {
        id: "conflict",
        type: "phrase",
        pattern: "全文翻译",
      },
    ],
  };
  const conflictingRegistry = {
    ...registry,
    registry: {
      ...registry.registry,
      skills: registry.registry.skills.map((item) =>
        item.slug === conflict.slug ? conflict : item,
      ),
    },
  };
  assert.equal(
    decide({
      registry: conflictingRegistry,
      userText: "请全文翻译这份文档",
    }).reasonCode,
    "intent_ambiguous",
  );
});

test("AC-14/15/16 continuation requires a successful workflow and related text", () => {
  const continuation = {
    primarySkillSlug: "skill-wr-industry",
    succeeded: true,
  };
  assert.equal(
    decide({ userText: "继续补充竞争格局", continuation }).selectionSource,
    "continuation",
  );
  assert.equal(
    decide({ userText: "1+1 等于几", continuation }).decisionOutcome,
    "none",
  );
  assert.equal(
    decide({
      userText: "继续补充",
      continuation: { ...continuation, succeeded: false },
    }).decisionOutcome,
    "none",
  );
});

test("AC-17 module dependencies are a stable closure", () => {
  const simulation = decide({
    moduleId: "simulation",
    userText: "推演市场变化",
  });
  assert.deepEqual(simulation.requiredSkillSlugs, ["skill-world-model"]);
  const drawing = decide({ moduleId: "3d", userText: "绘制零件" });
  assert.deepEqual(drawing.requiredSkillSlugs, [
    "skill-industrial-drawing-export",
    "skill-industrial-drawing-parametric",
  ]);
});

test("capability checks cover explicit, module and dependency requirements", () => {
  const explicit = decide({
    requestedSkillSlug: "skill-kb-qa",
    availableCapabilities: new Set(),
  });
  assert.deepEqual(
    [explicit.decisionOutcome, explicit.reasonCode],
    ["rejected", "capability_unavailable"],
  );

  const unavailableModule = decide({
    moduleId: "3d",
    userText: "绘制零件",
    availableCapabilities: new Set(["cad-runtime"]),
  });
  assert.deepEqual(
    [unavailableModule.decisionOutcome, unavailableModule.reasonCode],
    ["none", "capability_unavailable"],
  );

  const availableModule = decide({
    moduleId: "3d",
    userText: "绘制零件",
    availableCapabilities: new Set(["cad-runtime", "openscad-toolchain"]),
  });
  assert.deepEqual(
    [availableModule.decisionOutcome, availableModule.primarySkillSlug],
    ["selected", "skill-industrial-drawing-base"],
  );
});
