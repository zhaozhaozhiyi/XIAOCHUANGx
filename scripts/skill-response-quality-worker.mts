import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  composeAgentRunPayload,
  loadSkillRegistry,
  resolveChatOrchestration,
  runAgent,
  selectSkill,
} from "../packages/runtime-core/src/index.js";
import type { AgentId } from "../packages/runtime-core/src/types.js";
import {
  appendFinalSegment,
  createFinalSegmentAccumulator,
} from "../companion/src/runs/assistant-segments.js";

type Variant = "legacy" | "candidate";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const args = new Map(
  process.argv.slice(2).map((item) => {
    const [key, ...rest] = item.replace(/^--/, "").split("=");
    return [key, rest.join("=")];
  }),
);
const variant = args.get("variant") as Variant | undefined;
const agentId = args.get("agent") as AgentId | undefined;
const outputPath = args.get("output");
const concurrency = Number(args.get("concurrency") ?? "2");
const resume = args.get("resume") === "true";
const retryFailed = args.get("retry-failed") === "true";
const haltOnFailure = args.get("halt-on-failure") !== "false";

assert(variant === "legacy" || variant === "candidate", "invalid --variant");
assert(
  agentId === "codex" || agentId === "claude" || agentId === "hermes",
  "invalid --agent",
);
assert(outputPath, "missing --output");
assert(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 4);

const fixtureFile = JSON.parse(
  await readFile(
    join(repoRoot, "scripts", "fixtures", "skill-orchestration-quality.json"),
    "utf8",
  ),
);
assert.equal(fixtureFile.fixtures.length, 24);

const versionArgs: Record<AgentId, string[]> = {
  codex: ["--version"],
  claude: ["--version"],
  hermes: ["--version"],
  "cursor-agent": ["--version"],
  gemini: ["--version"],
  opencode: ["--version"],
  copilot: ["--version"],
  qoder: ["--version"],
  deepseek: ["--version"],
  devin: ["--version"],
  pi: ["--version"],
  kiro: ["--version"],
  kilo: ["--version"],
  vibe: ["--version"],
  openclaw: ["--version"],
};
const agentVersion = execFileSync(agentId, versionArgs[agentId], {
  encoding: "utf8",
  timeout: 30_000,
})
  .trim()
  .split("\n")
  .filter((line) => !/^Update available:/i.test(line.trim()))
  .join("\n");
const registry = loadSkillRegistry();
const legacy = resolveChatOrchestration({ mode: "auto" });

async function runFixture(fixture: {
  id: string;
  category: string;
  userText: string;
  expectedDecisionOutcome: string;
  expectedResponseMode: string;
}) {
  const messages = [{ role: "user" as const, content: fixture.userText }];
  const decision =
    variant === "candidate"
      ? selectSkill({
          registry,
          decisionId: `quality-${agentId}-${fixture.id}`,
          runId: `quality-${agentId}-${fixture.id}`,
          sessionId: `quality-${agentId}-${fixture.id}`,
          decidedAt: "2026-07-24T00:00:00.000Z",
          moduleId: "chat",
          userText: fixture.userText,
        })
      : null;
  if (decision) {
    assert.equal(decision.decisionOutcome, fixture.expectedDecisionOutcome);
  }

  const payload = composeAgentRunPayload({
    mode: "auto",
    userText: fixture.userText,
    messages,
    orchestrationVersion: variant === "legacy" ? "legacy" : "v2",
    ...(variant === "legacy"
      ? {
          processSkill: legacy.baseProcessSkill,
          platformNormSkill: legacy.platformNormSkill,
          chatCatalog: legacy.catalog,
        }
      : { skillDecision: decision }),
    agentId,
    cwd: repoRoot,
  });

  let fallbackText = "";
  let segmentText = "";
  let error: { code?: string; message: string } | null = null;
  const segments = createFinalSegmentAccumulator();
  const startedAt = Date.now();
  const result = await runAgent(
    {
      agentId,
      agentModel: "default",
      cwd: repoRoot,
      mode: "auto",
      composedPrompt: payload.composedPrompt,
      ...(variant === "legacy"
        ? {
            processSkill: legacy.baseProcessSkill,
            platformNormSkill: legacy.platformNormSkill,
          }
        : {}),
    },
    {
      onText(chunk) {
        fallbackText += chunk;
      },
      onAssistantSegment(segment) {
        segmentText += appendFinalSegment(segments, segment);
      },
      onError(message, code) {
        error = { code, message };
      },
    },
    { timeoutMs: 180_000, idleTimeoutMs: 90_000 },
  );
  const answer = (segmentText || fallbackText).trim();
  const status =
    !error && result.exitCode === 0 && !result.emptyOutput && answer
      ? "completed"
      : "failed";
  console.log(
    `[quality] ${variant}/${agentId}/${fixture.id} ${status} ${Date.now() - startedAt}ms`,
  );
  return {
    fixtureId: fixture.id,
    category: fixture.category,
    userText: fixture.userText,
    expectedResponseMode: fixture.expectedResponseMode,
    status,
    answer,
    error,
    durationMs: Date.now() - startedAt,
    prompt: {
      chars: payload.composedPrompt.length,
      instructionHash: `sha256:${createHash("sha256")
        .update(payload.instructionPrompt)
        .digest("hex")}`,
      orchestrationMode: payload.meta.orchestrationMode ?? null,
      injectedSkills: payload.meta.injectedSlugs,
      catalogEntries: payload.meta.catalogSlugs?.length ?? 0,
      decisionOutcome: decision?.decisionOutcome ?? null,
    },
  };
}

const previousReport = resume
  ? await readFile(outputPath, "utf8")
      .then((text) => JSON.parse(text))
      .catch(() => null)
  : null;
const previousByFixture = new Map(
  previousReport?.variant === variant && previousReport?.agentId === agentId
    ? previousReport.results
        .filter((item: { fixtureId?: string } | null) => item?.fixtureId)
        .map((item: { fixtureId: string }) => [item.fixtureId, item])
    : [],
);
const results = new Array(fixtureFile.fixtures.length);
const buildReport = () => ({
  reportVersion: 1,
  variant,
  baselineVersion: fixtureFile.baselineVersion,
  candidateVersion: fixtureFile.candidateVersion,
  agentId,
  agentModel: "default",
  agentVersion,
  fixedContext: {
    moduleId: "chat",
    mode: "auto",
    cwd: repoRoot,
    inputContext: "single user turn",
  },
  results,
});
let saveChain = Promise.resolve();
function saveProgress() {
  saveChain = saveChain.then(async () => {
    await mkdir(dirname(outputPath), { recursive: true });
    const temporaryPath = `${outputPath}.tmp-${process.pid}`;
    await writeFile(
      temporaryPath,
      `${JSON.stringify(buildReport(), null, 2)}\n`,
      "utf8",
    );
    await rename(temporaryPath, outputPath);
  });
  return saveChain;
}
const pendingFixtureIndexes: number[] = [];
for (let index = 0; index < fixtureFile.fixtures.length; index += 1) {
  const previous = previousByFixture.get(fixtureFile.fixtures[index].id) as
    | { status?: string }
    | undefined;
  if (previous?.status === "completed") results[index] = previous;
  else pendingFixtureIndexes.push(index);
}
let nextFixtureIndex = 0;
let halted = false;
async function runQueue() {
  while (!halted && nextFixtureIndex < pendingFixtureIndexes.length) {
    const index = pendingFixtureIndexes[nextFixtureIndex];
    nextFixtureIndex += 1;
    const fixture = fixtureFile.fixtures[index];
    const previous = previousByFixture.get(fixture.id) as any;
    const attempts = previous?.attempts ??
      (previous
        ? [
            {
              status: previous.status,
              error: previous.error,
              durationMs: previous.durationMs,
            },
          ]
        : []);
    let current = previous;
    const maximumAttempts = retryFailed ? attempts.length + 1 : 2;
    while (
      attempts.length < maximumAttempts &&
      current?.status !== "completed"
    ) {
      current = await runFixture(fixture);
      attempts.push({
        status: current.status,
        error: current.error,
        durationMs: current.durationMs,
      });
    }
    results[index] = { ...current, attempts };
    await saveProgress();
    if (haltOnFailure && current?.status !== "completed") {
      halted = true;
    }
  }
}
await Promise.all(
  Array.from(
    { length: Math.min(concurrency, pendingFixtureIndexes.length) },
    () => runQueue(),
  ),
);

await saveProgress();
if (
  variant === "candidate" &&
  results.some((item) => item?.status !== "completed")
) {
  process.exitCode = 1;
}
