import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

import type { CreateRunRequest } from "../companion/src/types.js";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dataDir = await mkdtemp(join(tmpdir(), "jlc-skill-legacy-rollback-"));
process.env.COMPANION_DATA_DIR = dataDir;
process.env.COMPANION_RUN_MODE = "simulate";
process.env.SKILL_ORCHESTRATION_V2_ENABLED = "false";

const { executeRunLifecycle } = await import(
  "../companion/src/runs/manager.js"
);
const { createRuntimeStoreWriter } = await import(
  "../companion/src/runs/runtime-store-writer.js"
);
const { loadRunEvents, loadRunRecord } = await import(
  "../companion/src/runs/store.js"
);

after(async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(dataDir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "ENOTEMPTY" ||
        attempt === 4
      ) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
});

test("AC-25 feature flag restores the 0.1.6 orchestration path", async () => {
  const matrix = JSON.parse(
    await readFile(
      join(
        repoRoot,
        "scripts",
        "fixtures",
        "skill-orchestration-compatibility.json",
      ),
      "utf8",
    ),
  );
  assert.equal(matrix.featureFlag, "SKILL_ORCHESTRATION_V2_ENABLED");
  assert.equal(matrix.rollback.requiresDataMigration, false);
  assert.equal(matrix.rollback.deletesEvents, false);
  assert.equal(matrix.rollback.deletesMessages, false);
  assert.equal(matrix.rollback.modifiesWorkspace, false);

  const runId = "run-legacy-rollback";
  const request: CreateRunRequest = {
    sessionId: "session-legacy-rollback",
    projectId: "none",
    workspaceProjectId: "__lazy_default__",
    lazyDefaultWorkspace: {
      moduleId: "chat",
      taskId: "session-legacy-rollback",
    },
    moduleId: "chat",
    binding: { moduleId: "chat", mode: "auto" },
    agentId: "codex",
    agentModel: "default",
    messages: [{ role: "user", content: "你好" }],
    processSkill: "skill-qa",
    platformNormSkill: "skill-platform-research-norms",
  };
  const writer = createRuntimeStoreWriter(request, runId, {
    send() {},
    end() {},
  });
  await executeRunLifecycle(request, writer, runId);
  const record = await loadRunRecord(runId);
  const events = await loadRunEvents(runId);
  assert.ok(record);
  assert.equal(record.skillDecision, undefined);
  assert.equal(events.some((event) => event.type.startsWith("skill.")), false);
  const started = events.find((event) => event.type === "run.started");
  assert.equal(
    started?.type === "run.started" && started.orchestrationMode,
    "hybrid-steer",
  );
  assert.equal(
    started?.type === "run.started" && started.processSkill,
    "skill-qa",
  );
  assert.equal(
    started?.type === "run.started" && started.platformNormSkill,
    "skill-platform-research-norms",
  );
  assert.equal(
    started?.type === "run.started" && started.catalogSlugs?.length,
    22,
  );
  assert.deepEqual(
    started?.type === "run.started" ? started.injectedSkills : undefined,
    ["skill-platform-research-norms", "skill-qa"],
  );
});
