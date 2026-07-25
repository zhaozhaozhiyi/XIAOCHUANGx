import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { RunEvent, RunRecord } from "../packages/contracts/src/index.js";
import type { AgentId, CreateRunRequest } from "../companion/src/types.js";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const evidenceDir =
  process.env.JLC_SKILL_EVIDENCE_DIR?.trim() ||
  join(repoRoot, "output", "skill-orchestration-0.1.7");
const dataDir = await mkdtemp(join(tmpdir(), "jlc-skill-real-agents-"));
process.env.COMPANION_DATA_DIR = dataDir;
process.env.COMPANION_RUN_MODE = "cli";
process.env.COMPANION_CLI_FALLBACK = "error";
process.env.COMPANION_HERMES_GATEWAY = "false";
process.env.SKILL_ORCHESTRATION_V2_ENABLED = "true";

const { executeRunLifecycle } = await import(
  "../companion/src/runs/manager.js"
);
const { createRuntimeStoreWriter } = await import(
  "../companion/src/runs/runtime-store-writer.js"
);
const { loadRunEvents, loadRunRecord } = await import(
  "../companion/src/runs/store.js"
);

type Scenario = {
  id: "none" | "selected";
  userText: string;
  requestedSkillSlug?: string;
};

const agents = ["codex", "claude", "hermes"] as const satisfies AgentId[];
const scenarios: Scenario[] = [
  {
    id: "none",
    userText: "只回复两个字母：OK",
  },
  {
    id: "selected",
    userText: "把 Hello 翻译成中文，只回复译文。",
    requestedSkillSlug: "skill-tr-doc",
  },
];

function request(agentId: AgentId, scenario: Scenario): CreateRunRequest {
  const sessionId = `real-${agentId}-${scenario.id}`;
  return {
    sessionId,
    projectId: "none",
    workspaceProjectId: "__lazy_default__",
    lazyDefaultWorkspace: {
      moduleId: "chat",
      taskId: sessionId,
      taskTitle: `0.1.7 real-agent ${scenario.id}`,
    },
    moduleId: "chat",
    binding: { moduleId: "chat", mode: "fast" },
    agentId,
    agentModel: "default",
    messages: [{ role: "user", content: scenario.userText }],
    useClientHistory: false,
    ...(scenario.requestedSkillSlug
      ? { requestedSkillSlug: scenario.requestedSkillSlug }
      : {}),
    timeoutProfile: "fast",
    timeoutMs: 180_000,
    idleTimeoutMs: 90_000,
  };
}

async function execute(
  agentId: AgentId,
  scenario: Scenario,
): Promise<{ record: RunRecord; events: RunEvent[] }> {
  const runId = `run-real-${agentId}-${scenario.id}`;
  const req = request(agentId, scenario);
  const writer = createRuntimeStoreWriter(req, runId, {
    send() {},
    end() {},
  });
  const startedAt = Date.now();
  console.log(`[real-agents] RUN ${agentId}/${scenario.id}`);
  await executeRunLifecycle(req, writer, runId);
  const record = await loadRunRecord(runId);
  assert.ok(record, `${agentId}/${scenario.id}: missing RunRecord`);
  const events = await loadRunEvents(runId);
  console.log(
    `[real-agents] ${record.status === "completed" ? "PASS" : "FAIL"} ${agentId}/${scenario.id} status=${record.status} duration=${Date.now() - startedAt}ms`,
  );
  return { record, events };
}

function summarize(
  agentId: AgentId,
  scenario: Scenario,
  result: { record: RunRecord; events: RunEvent[] },
) {
  const started = result.events.find((event) => event.type === "run.started");
  const skillEvents = result.events.filter((event) =>
    event.type.startsWith("skill."),
  );
  const ready = skillEvents.find((event) => event.type === "skill.ready");
  const finalAnswer = result.record.canonicalOutput?.finalAnswer.markdown ?? "";
  return {
    agentId,
    scenario: scenario.id,
    status: result.record.status,
    decision: {
      outcome: result.record.skillDecision?.decisionOutcome,
      primarySkillSlug: result.record.skillDecision?.primarySkillSlug,
      requiredSkillSlugs: result.record.skillDecision?.requiredSkillSlugs,
      selectionSource: result.record.skillDecision?.selectionSource,
      reasonCode: result.record.skillDecision?.reasonCode,
    },
    skillEventTypes: skillEvents.map((event) => event.type),
    skillDecisionIds: [
      ...new Set(
        skillEvents.flatMap((event) =>
          "decisionId" in event ? [event.decisionId] : [],
        ),
      ),
    ],
    bundleHash:
      started?.type === "run.started" ? started.bundleHash ?? null : null,
    readyItems:
      ready?.type === "skill.ready"
        ? ready.items.map((item) => ({
            slug: item.slug,
            version: item.version,
            contentHash: item.contentHash,
          }))
        : [],
    finalAnswerChars: finalAnswer.length,
    finalAnswerPreview: finalAnswer.replace(/\s+/g, " ").trim().slice(0, 160),
  };
}

const summaries = [];
try {
  for (const agentId of agents) {
    for (const scenario of scenarios) {
      summaries.push(
        summarize(agentId, scenario, await execute(agentId, scenario)),
      );
    }
  }

  for (const summary of summaries) {
    assert.equal(summary.status, "completed", `${summary.agentId}/${summary.scenario}`);
    assert(summary.finalAnswerChars > 0, `${summary.agentId}/${summary.scenario}: empty answer`);
    if (summary.scenario === "none") {
      assert.equal(summary.decision.outcome, "none");
      assert.deepEqual(summary.skillEventTypes, []);
    } else {
      assert.deepEqual(summary.decision, {
        outcome: "selected",
        primarySkillSlug: "skill-tr-doc",
        requiredSkillSlugs: [],
        selectionSource: "explicit",
        reasonCode: "explicit_structured",
      });
      assert.deepEqual(summary.skillEventTypes, ["skill.selected", "skill.ready"]);
      assert.equal(summary.skillDecisionIds.length, 1);
    }
  }

  const selected = summaries.filter((item) => item.scenario === "selected");
  for (const current of selected.slice(1)) {
    assert.equal(current.bundleHash, selected[0]?.bundleHash);
    assert.deepEqual(current.readyItems, selected[0]?.readyItems);
  }

  const report = {
    reportVersion: 1,
    candidateVersion: "0.1.7",
    runMode: "cli",
    fallback: "error",
    agents: summaries,
    gates: {
      allRunsCompleted: summaries.every((item) => item.status === "completed"),
      noneHasNoSkillEvents: summaries
        .filter((item) => item.scenario === "none")
        .every((item) => item.skillEventTypes.length === 0),
      selectedDecisionConsistent: selected.every(
        (item) => JSON.stringify(item.decision) === JSON.stringify(selected[0]?.decision),
      ),
      selectedBundleConsistent: selected.every(
        (item) =>
          item.bundleHash === selected[0]?.bundleHash &&
          JSON.stringify(item.readyItems) === JSON.stringify(selected[0]?.readyItems),
      ),
    },
  };
  await mkdir(evidenceDir, { recursive: true });
  const jsonPath = join(evidenceDir, "real-agents-report.json");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const markdown = [
    "# 0.1.7 Real Agent Report",
    "",
    "| Agent | Scenario | Status | Decision | Skill events | Bundle | Answer |",
    "|---|---|---|---|---|---|---|",
    ...summaries.map(
      (item) =>
        `| ${item.agentId} | ${item.scenario} | ${item.status} | ${item.decision.outcome}/${item.decision.selectionSource ?? "none"} | ${item.skillEventTypes.join(" -> ") || "none"} | ${item.bundleHash ?? "none"} | ${item.finalAnswerPreview.replace(/\|/g, "\\|")} |`,
    ),
    "",
    ...Object.entries(report.gates).map(
      ([gate, passed]) => `- [${passed ? "x" : " "}] ${gate}`,
    ),
    "",
  ].join("\n");
  await writeFile(
    join(evidenceDir, "real-agents-report.md"),
    markdown,
    "utf8",
  );
  console.log(`PASS real agents ${summaries.length}/${summaries.length}; report=${jsonPath}`);
} finally {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await rm(dataDir, { recursive: true, force: true });
      break;
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "ENOTEMPTY" ||
        attempt === 7
      ) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}
