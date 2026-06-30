#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function readFlag(name, fallback) {
  const args = process.argv.filter((arg) => arg !== "--");
  const idx = args.findIndex((arg) => arg === `--${name}`);
  if (idx >= 0 && args[idx + 1] !== undefined) {
    return args[idx + 1];
  }
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

const repoRoot = process.cwd();
const fixturePath = path.join(repoRoot, "docs/qa/writing-ppt-ai-ui-fixtures.json");
const base = readFlag("base", process.env.COMPANION_BASE_URL ?? "http://127.0.0.1:9477");
const agentId = readFlag("agent", "codex");
const timeoutSec = Number(readFlag("timeout", "180"));
const caseFilter = readFlag("case", "");
const flowFilter = readFlag("flow", "");
const soft = hasFlag("soft");
const stagePartKinds = new Set([
  "writing_requirements",
  "writing_requirement_summary",
  "writing_outline",
  "ppt_requirements",
  "ppt_requirement_summary",
  "ppt_outline",
]);

function selectFixtures(items, filter, label) {
  if (!filter) return items;
  const wanted = new Set(filter.split(",").map((id) => id.trim()).filter(Boolean));
  const selected = items.filter((item) => wanted.has(item.id));
  if (selected.length === 0) {
    throw new Error(`no ${label} fixtures matched ${filter}`);
  }
  return selected;
}

function loadFixtureFile() {
  const raw = fs.readFileSync(fixturePath, "utf8");
  return JSON.parse(raw);
}

async function getWorkspaceRoot() {
  const health = await getJson("/v1/health");
  if (!health.ok) {
    throw new Error(`health failed status=${health.status}`);
  }
  return health.body?.dataDir ? path.join(health.body.dataDir, "projects", "sandbox-default") : null;
}

function loadFixtures() {
  const fixture = loadFixtureFile();
  if (flowFilter) {
    return {
      mode: "flow",
      fixtureFile: fixture,
      fixtures: selectFixtures(fixture.flowFixtures ?? [], flowFilter, "flow"),
    };
  }
  return {
    mode: "case",
    fixtureFile: fixture,
    fixtures: selectFixtures(fixture.firstTurnFixtures ?? [], caseFilter, "first-turn"),
  };
}

async function getJson(pathname) {
  const res = await fetch(`${base}${pathname}`);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

function parseSseBlock(block) {
  let event = "message";
  const dataLines = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  const data = dataLines.join("\n");
  if (!data) return null;
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return { event, data };
  }
}

function parseSseEvents(text) {
  const events = [];
  for (const block of text.split(/\n\n+/)) {
    const parsed = parseSseBlock(block);
    if (parsed) events.push(parsed);
  }
  return events;
}

function inputForFixture(fixture, fixtureFile) {
  if (typeof fixture.input === "string") return fixture.input;
  if (typeof fixture.inputRef === "string") {
    const referenced = (fixtureFile.firstTurnFixtures ?? []).find(
      (item) => item.id === fixture.inputRef,
    );
    if (referenced?.input) return referenced.input;
  }
  throw new Error(`${fixture.id}: missing input`);
}

function requestForFixture(fixture, fixtureFile, override = {}) {
  const moduleId = fixture.moduleId;
  const processSkill =
    moduleId === "writing" ? "skill-writing-base" : "skill-ppt-base";
  const binding =
    moduleId === "writing"
      ? { moduleId: "writing", templateId: "general" }
      : { moduleId: "ppt", task: "deck", templateId: "pitch-deck" };
  return {
    sessionId: override.sessionId ?? `smoke-${fixture.id.toLowerCase()}-${Date.now()}`,
    projectId: "sandbox-default",
    workspaceProjectId: "sandbox-default",
    moduleId,
    binding,
    agentId,
    agentModel: "default",
    messages: override.messages ?? [
      {
        role: "user",
        content: inputForFixture(fixture, fixtureFile),
      },
    ],
    useClientHistory: false,
    processSkill,
    platformNormSkill: "skill-platform-research-norms",
    timeoutProfile: moduleId === "writing" ? "writing" : "ppt",
  };
}

async function runFixture(fixture, fixtureFile) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSec * 1000);
  const res = await fetch(`${base}/v1/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(requestForFixture(fixture, fixtureFile)),
    signal: controller.signal,
  });
  clearTimeout(timer);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST /v1/runs ${res.status}: ${text.slice(0, 400)}`);
  }

  const events = parseSseEvents(await res.text());
  const appendedParts = events
    .filter((event) => event.event === "part.append")
    .map((event) => event.data?.part)
    .filter(Boolean);
  const partKinds = appendedParts
    .map((part) => part.kind)
    .filter((kind) => typeof kind === "string");
  const assistantText = events
    .filter((event) => event.event === "message.delta")
    .map((event) =>
      typeof event.data?.content === "string" ? event.data.content : "",
    )
    .join("");
  const eventNames = events.map((event) => event.event);
  const terminal = [...eventNames]
    .reverse()
    .find((name) => ["run.finished", "run.error", "run.cancelled"].includes(name));

  return {
    events,
    eventNames,
    partKinds,
    assistantText,
    terminal,
  };
}

async function submitClarification(runId, toolUseId, content) {
  const res = await fetch(
    `${base}/v1/runs/${encodeURIComponent(runId)}/clarification`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolUseId, content }),
    },
  );
  if (res.ok) return;
  const text = await res.text().catch(() => "");
  throw new Error(
    `POST /v1/runs/${runId}/clarification ${res.status}: ${text.slice(0, 400)}`,
  );
}

function collectRunResult(events) {
  const appendedParts = events
    .filter((event) => event.event === "part.append")
    .map((event) => event.data?.part)
    .filter(Boolean);
  const patchedParts = events
    .filter((event) => event.event === "part.patch")
    .map((event) => event.data)
    .filter(Boolean);
  const partKinds = appendedParts
    .map((part) => part.kind)
    .filter((kind) => typeof kind === "string");
  const assistantText = events
    .filter((event) => event.event === "message.delta")
    .map((event) =>
      typeof event.data?.content === "string" ? event.data.content : "",
    )
    .join("");
  const eventNames = events.map((event) => event.event);
  const terminal = eventNames.find((name) =>
    ["run.finished", "run.error", "run.cancelled"].includes(name),
  );
  return {
    events,
    eventNames,
    appendedParts,
    patchedParts,
    partKinds,
    assistantText,
    terminal,
  };
}

async function readRunStream(res, fixture, onEvent) {
  const controller = new AbortController();
  if (!res.body) {
    throw new Error("POST /v1/runs returned an empty body");
  }

  const events = [];
  const decoder = new TextDecoder();
  const reader = res.body.getReader();
  let buffer = "";
  let terminalSeen = false;

  async function handleEvent(parsed) {
    events.push(parsed);
    await onEvent?.(parsed);
    if (["run.finished", "run.error", "run.cancelled"].includes(parsed.event)) {
      terminalSeen = true;
    }
  }

  try {
    while (!terminalSeen) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const parsed = parseSseBlock(block);
        if (parsed) await handleEvent(parsed);
        if (terminalSeen) break;
        boundary = buffer.indexOf("\n\n");
      }
    }
    buffer += decoder.decode();
    const trailing = parseSseBlock(buffer.trim());
    if (trailing && !terminalSeen) await handleEvent(trailing);
  } finally {
    if (!terminalSeen) {
      await reader.cancel().catch(() => {});
    }
  }

  return collectRunResult(events);
}

async function postRun(fixture, fixtureFile, override, signal) {
  const res = await fetch(`${base}/v1/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(requestForFixture(fixture, fixtureFile, override)),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`POST /v1/runs ${res.status}: ${text.slice(0, 400)}`);
  }
  return res;
}

async function runFlowFixture(fixture, fixtureFile) {
  if (fixture.operation) {
    return {
      operationOnly: true,
      events: [],
      eventNames: [],
      appendedParts: [],
      patchedParts: [],
      partKinds: [],
      assistantText: "",
      terminal: "operation-only",
    };
  }

  // formAnswer 是可选：T6/T7（指定模板 + 信息充分）与 T8（指定模板 + 信息不足只验证表单）
  // 这类用例只跑首轮；不发 clarification、不发 follow-up。
  const skipFormFlow = !fixture.formAnswer;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSec * 1000);
  const sessionId = `smoke-${fixture.id.toLowerCase()}-${Date.now()}`;
  const originalUser = inputForFixture(fixture, fixtureFile);
  const messages = [
    {
      role: "user",
      content: originalUser,
    },
  ];
  const allEvents = [];
  let clarificationSubmitted = false;
  let answerSentAsFollowup = false;
  let followupNeeded = false;

  try {
    const firstRes = await postRun(
      fixture,
      fixtureFile,
      { sessionId, messages },
      controller.signal,
    );
    const first = await readRunStream(firstRes, fixture, async (parsed) => {
      allEvents.push(parsed);
      if (skipFormFlow) return;
      const part = parsed.event === "part.append" ? parsed.data?.part : null;
      const isRequirementsPart =
        part?.kind === "writing_requirements" || part?.kind === "ppt_requirements";
      if (!isRequirementsPart || clarificationSubmitted || answerSentAsFollowup) {
        return;
      }

      if (part.runId && part.toolUseId) {
        await submitClarification(part.runId, part.toolUseId, fixture.formAnswer);
        clarificationSubmitted = true;
      } else {
        followupNeeded = true;
      }
    });

    if (followupNeeded) {
      const assistantText = first.assistantText.trim();
      if (assistantText) {
        messages.push({
          role: "assistant",
          content: assistantText,
        });
      }
      messages.push({
        role: "user",
        content: `我补充的信息如下，请继续完成刚才的任务：\n\n${fixture.formAnswer}`,
      });
      const followupRes = await postRun(
        fixture,
        fixtureFile,
        { sessionId, messages },
        controller.signal,
      );
      const followup = await readRunStream(followupRes, fixture, async (parsed) => {
        allEvents.push(parsed);
      });
      answerSentAsFollowup = true;
      return {
        ...collectRunResult(allEvents),
        clarificationSubmitted,
        answerSentAsFollowup,
        runCount: 2,
        followupTerminal: followup.terminal,
      };
    }

    return {
      ...collectRunResult(allEvents),
      clarificationSubmitted,
      answerSentAsFollowup,
      runCount: 1,
      skipFormFlow,
    };
  } finally {
    clearTimeout(timer);
  }
}

function checkFixture(fixture, result) {
  const failures = [];
  const expect = fixture.expect ?? {};
  const hasPart = (kind) => result.partKinds.includes(kind);

  for (const kind of expect.requiredParts ?? []) {
    if (!hasPart(kind)) failures.push(`missing required part ${kind}`);
  }

  for (const kind of expect.requiredAnyParts ?? []) {
    if ((expect.requiredAnyParts ?? []).some((candidate) => hasPart(candidate))) {
      break;
    }
    failures.push(`missing any required part of ${expect.requiredAnyParts.join(", ")}`);
    break;
  }

  for (const kind of expect.forbiddenParts ?? []) {
    if (hasPart(kind)) failures.push(`forbidden part emitted ${kind}`);
  }

  if (result.terminal === "run.error") {
    const error = result.events.find((event) => event.event === "run.error");
    failures.push(`run.error ${JSON.stringify(error?.data)}`);
  }
  if (!result.terminal) {
    failures.push("missing terminal event");
  }

  return failures;
}

function hasStructuredOutline(part) {
  if (part?.kind === "writing_outline") {
    return Array.isArray(part.outline?.sections) && part.outline.sections.length > 0;
  }
  if (part?.kind === "ppt_outline") {
    return Array.isArray(part.outline?.slides) && part.outline.slides.length > 0;
  }
  return false;
}

function artifactPaths(result) {
  const paths = [];
  for (const part of result.appendedParts ?? []) {
    if (part.kind === "artifact" && typeof part.path === "string") {
      paths.push(part.path);
    }
    if (part.kind === "deliverables") {
      if (typeof part.primaryPath === "string") paths.push(part.primaryPath);
      for (const item of part.items ?? []) {
        if (typeof item.path === "string") paths.push(item.path);
      }
    }
  }
  for (const event of result.events ?? []) {
    if (event.event === "artifact_found" && typeof event.data?.path === "string") {
      paths.push(event.data.path);
    }
  }
  return [...new Set(paths)];
}

function artifactFilesFromWorkspace(root) {
  if (!root || !fs.existsSync(root)) return [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if ([".md", ".markdown", ".html", ".pptx", ".ppt"].includes(ext)) {
      files.push(entry.name);
    }
  }
  return files.sort();
}

function checkFlowFixture(fixture, result, workspaceFiles = []) {
  const failures = [];
  if (result.operationOnly) {
    failures.push(
      "operation fixture requires browser E2E coverage; run `pnpm -C web test:e2e chat.spec.ts --project=chromium --grep \"persists committed outline\"`",
    );
    return failures;
  }

  const hasPart = (kind) => result.partKinds.includes(kind);
  const hasDeliverables =
    hasPart("deliverables") ||
    hasPart("artifact") ||
    result.eventNames.includes("artifact_found");

  const counts = new Map();
  for (const kind of result.partKinds) {
    if (!stagePartKinds.has(kind)) continue;
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  for (const [kind, count] of counts) {
    if (count > 1) failures.push(`repeated stage part ${kind} x${count}`);
  }

  for (const stage of fixture.expectedStages ?? []) {
    if (stage === "draft") {
      if (result.assistantText.replace(/\s+/g, "").length < 120) {
        failures.push("missing draft text after clarification");
      }
      continue;
    }
    if (stage === "deliverables") {
      if (!hasDeliverables) failures.push("missing deliverables/artifact output");
      continue;
    }
    if (!hasPart(stage)) failures.push(`missing expected stage ${stage}`);
  }

  for (const kind of fixture.mustNotEmit ?? []) {
    if (hasPart(kind)) failures.push(`forbidden part emitted ${kind}`);
  }

  if (fixture.outline?.requiresStructured) {
    const outlinePart = (result.appendedParts ?? []).find(
      (part) => part.kind === "writing_outline" || part.kind === "ppt_outline",
    );
    if (!hasStructuredOutline(outlinePart)) {
      failures.push("outline part missing structured sections/slides");
    }
  }

  const paths = artifactPaths(result);
  const visibleFiles = workspaceFiles.map((file) => file.replace(/\\/g, "/"));
  for (const artifact of fixture.expectedArtifacts ?? []) {
    if (!artifact.required) continue;
    const extension = artifact.extension;
    if (
      extension &&
      ![...paths, ...visibleFiles].some((item) => item.endsWith(extension))
    ) {
      failures.push(`missing required artifact ${extension}`);
    }
  }

  if (!result.skipFormFlow) {
    if (!result.clarificationSubmitted && !result.answerSentAsFollowup) {
      failures.push("clarification answer was not submitted");
    }
  }

  // mustAskMissingFields / mustAskAnyOfGroups：T8 这类用例只验证表单卡里追问了哪些字段。
  // - mustAskMissingFields: 每个字面值都必须出现
  // - mustAskAnyOfGroups: 每个分组里至少有一个同义字面值出现（适配 AI 自由表达）
  if (
    (fixture.mustAskMissingFields?.length ?? 0) > 0 ||
    (fixture.mustAskAnyOfGroups?.length ?? 0) > 0
  ) {
    const requirementsPart = (result.appendedParts ?? []).find(
      (part) =>
        part.kind === "writing_requirements" || part.kind === "ppt_requirements",
    );
    const haystack = requirementsPart
      ? JSON.stringify(requirementsPart)
      : result.assistantText;
    for (const field of fixture.mustAskMissingFields ?? []) {
      if (!haystack.includes(field)) {
        failures.push(`requirements card missing expected field "${field}"`);
      }
    }
    for (const group of fixture.mustAskAnyOfGroups ?? []) {
      if (!group.some((candidate) => haystack.includes(candidate))) {
        failures.push(
          `requirements card missing any of expected synonyms [${group.join(", ")}]`,
        );
      }
    }
  }

  if (result.terminal === "run.error") {
    const error = result.events.find((event) => event.event === "run.error");
    failures.push(`run.error ${JSON.stringify(error?.data)}`);
  }
  if (!result.terminal) {
    failures.push("missing terminal event");
  }

  return failures;
}

async function preflight() {
  const tag = "[smoke:writing-ppt-ai-ui]";
  let health;
  try {
    health = await getJson("/v1/health");
  } catch (error) {
    if (soft) {
      console.warn(`${tag} SKIP Companion unavailable at ${base}`);
      process.exit(0);
    }
    throw error;
  }
  if (!health.ok) {
    const msg = `health failed status=${health.status}`;
    if (soft) {
      console.warn(`${tag} SKIP ${msg}`);
      process.exit(0);
    }
    throw new Error(msg);
  }

  const agents = await getJson("/v1/agents");
  const target = agents.body?.agents?.find((agent) => agent.agentId === agentId);
  if (!agents.ok || target?.status !== "available") {
    const msg = `agent ${agentId} not available: status=${target?.status ?? "missing"}`;
    if (soft) {
      console.warn(`${tag} SKIP ${msg}`);
      process.exit(0);
    }
    throw new Error(msg);
  }
}

async function main() {
  const tag = "[smoke:writing-ppt-ai-ui]";
  const { mode, fixtureFile, fixtures } = loadFixtures();
  if (fixtures.length === 0) {
    throw new Error("no fixtures");
  }

  console.log(`${tag} base=${base} agent=${agentId} timeout=${timeoutSec}s ${mode}s=${fixtures.map((f) => f.id).join(",")}`);
  await preflight();
  const workspaceRoot = await getWorkspaceRoot();

  const allFailures = [];
  for (const fixture of fixtures) {
    console.log(`${tag} RUN ${fixture.id} module=${fixture.moduleId}`);
    let result;
    try {
      result =
        mode === "flow"
          ? await runFlowFixture(fixture, fixtureFile)
          : await runFixture(fixture, fixtureFile);
    } catch (error) {
      allFailures.push(`${fixture.id}: ${error instanceof Error ? error.message : error}`);
      console.error(`${tag} FAIL ${fixture.id}`, error instanceof Error ? error.message : error);
      continue;
    }
    const failures =
      mode === "flow"
        ? checkFlowFixture(fixture, result, artifactFilesFromWorkspace(workspaceRoot))
        : checkFixture(fixture, result);
    const summary = {
      terminal: result.terminal ?? "(none)",
      partKinds: result.partKinds,
      artifacts: [...new Set([...artifactPaths(result), ...artifactFilesFromWorkspace(workspaceRoot)])],
      clarificationSubmitted: result.clarificationSubmitted,
      answerSentAsFollowup: result.answerSentAsFollowup,
      runCount: result.runCount,
      eventCount: result.events.length,
      textPreview: result.assistantText.replace(/\s+/g, " ").trim().slice(0, 220),
      textTail: result.assistantText.replace(/\s+/g, " ").trim().slice(-220),
    };
    if (failures.length > 0) {
      allFailures.push(...failures.map((failure) => `${fixture.id}: ${failure}`));
      console.error(`${tag} FAIL ${fixture.id}`, summary, failures);
    } else {
      console.log(`${tag} PASS ${fixture.id}`, summary);
    }
  }

  if (allFailures.length > 0) {
    console.error(`${tag} FAILURES`);
    for (const failure of allFailures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`${tag} PASS all ${fixtures.length} fixtures`);
}

main().catch((error) => {
  console.error("[smoke:writing-ppt-ai-ui] FAIL", error instanceof Error ? error.message : error);
  process.exit(1);
});
