#!/usr/bin/env node
/**
 * S1.0 / S1.2 冒烟：Companion 健康 + 短 Run SSE 事件集。
 *
 * 用法：node scripts/smoke-companion-sse.mjs [选项]
 *   --base <url>       Companion 基址，默认 http://127.0.0.1:9477
 *   --timeout <sec>    单 Run 超时秒数，默认 120
 *   --agent <id>       目标 CLI（codex / claude / ...），默认 codex
 *   --skill <slug>     processSkill，默认 skill-qa
 *   --mode <auto|fast|deep> 对话策略，默认 auto
 *   --prompt <text>    覆盖默认短提示词
 *   --require-tool     要求至少一个带 callId 的完整工具生命周期
 *   --require-tool-payload  进一步要求工具生命周期包含 input/output
 *   --soft             指定 agent 在 /v1/agents 中不可用时退出码 0（仅打印 SKIP，不 fail）
 *
 * 设计要点：
 * - 单脚本支持多 CLI 真流冒烟；每个 CLI 单独跑一次，避免相互打架
 * - --soft 给 mvp:verify 串多个 CLI 时使用：本机没装 claude 不阻塞 codex 通过路径
 */
function readFlag(name, fallback) {
  const idx = process.argv.findIndex((a) => a === `--${name}`);
  if (idx >= 0 && process.argv[idx + 1] !== undefined) {
    return process.argv[idx + 1];
  }
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

const base = readFlag("base", process.env.COMPANION_BASE_URL ?? "http://127.0.0.1:9477");
const timeoutSec = Number(readFlag("timeout", "120"));
const agentId = readFlag("agent", "codex");
const processSkill = readFlag("skill", "skill-qa");
const mode = readFlag("mode", "auto");
const prompt = readFlag("prompt", "只回复一个字：好。不要解释。");
const requireToolPayload = hasFlag("require-tool-payload");
const requireTool = hasFlag("require-tool") || requireToolPayload;
const soft = hasFlag("soft");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(path) {
  let lastError = null;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      const res = await fetch(`${base}${path}`);
      const body = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, body };
    } catch (error) {
      lastError = error;
      await sleep(500);
    }
  }
  throw lastError;
}

function parseSseEvents(text) {
  const events = [];
  const blocks = text.split(/\n\n+/);
  for (const block of blocks) {
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (data) {
      try {
        events.push({ event, data: JSON.parse(data) });
      } catch {
        events.push({ event, data });
      }
    }
  }
  return events;
}

async function runSse() {
  const sessionId = `smoke-${agentId}-${Date.now()}`;
  const body = {
    sessionId,
    projectId: "none",
    workspaceProjectId: "sandbox-default",
    moduleId: "chat",
    binding: { moduleId: "chat", mode },
    agentId,
    agentModel: "default",
    messages: [{ role: "user", content: prompt }],
    useClientHistory: false,
    processSkill,
    platformNormSkill: "skill-platform-research-norms",
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSec * 1000);

  try {
    const res = await fetch(`${base}/v1/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`POST /v1/runs ${res.status}: ${errText.slice(0, 400)}`);
    }

    const text = await res.text();
    return { events: parseSseEvents(text), sessionId };
  } finally {
    clearTimeout(timer);
  }
}

function isCompatibilityDelta(event) {
  return (
    event?.event === "message.delta" &&
    event?.data?.compatibility === "assistant.segment"
  );
}

function isActionableTool(event) {
  return (
    event?.event === "tool.progress" &&
    event?.data?.tool !== "phase" &&
    event?.data?.tool !== "reasoning"
  );
}

function isTerminalToolStatus(status) {
  return (
    status === "success" ||
    status === "done" ||
    status === "error" ||
    status === "failed" ||
    status === "cancelled"
  );
}

function hasPayloadValue(value) {
  return value !== undefined && value !== null;
}

function checkStreamSequence(events, label, options = {}) {
  const failures = [];
  const requireAll = options.requireAll === true;
  const relevant = events.filter((event) => !isCompatibilityDelta(event));
  const seqs = [];

  for (const event of relevant) {
    const seq = event?.data?.streamSeq;
    if (!Number.isInteger(seq) || seq < 0) {
      if (requireAll) failures.push(`${label} ${event?.event ?? "event"} missing streamSeq`);
      continue;
    }
    seqs.push(seq);
    if (
      event.event === "part.append" &&
      event.data?.part?.streamSeq !== seq
    ) {
      failures.push(`${label} part.append nested streamSeq mismatch at ${seq}`);
    }
    if (
      event.event === "part.patch" &&
      event.data?.merge?.streamSeq !== seq
    ) {
      failures.push(`${label} part.patch nested streamSeq mismatch at ${seq}`);
    }
  }

  for (let index = 1; index < seqs.length; index += 1) {
    if (seqs[index] <= seqs[index - 1]) {
      failures.push(
        `${label} streamSeq is not strictly increasing: ${seqs[index - 1]} -> ${seqs[index]}`,
      );
      break;
    }
  }
  if (new Set(seqs).size !== seqs.length) {
    failures.push(`${label} streamSeq contains duplicates`);
  }

  return { failures, seqs };
}

function checkToolLifecycle(events, label, required, requirePayload = false) {
  const failures = [];
  const tools = events.filter(isActionableTool);
  const startsByCallId = new Map();
  const terminals = [];

  for (const event of tools) {
    const { callId, status } = event.data ?? {};
    if (typeof callId !== "string" || !callId) {
      failures.push(`${label} actionable tool ${event.data?.tool ?? "tool"} missing callId`);
      continue;
    }
    if (isTerminalToolStatus(status)) {
      terminals.push(event);
      if (!startsByCallId.has(callId)) {
        failures.push(`${label} terminal tool ${callId} has no preceding start`);
      }
    } else if (!startsByCallId.has(callId)) {
      startsByCallId.set(callId, event);
    }
  }

  if (required && tools.length === 0) {
    failures.push(`${label} missing actionable tool event`);
  }
  if (required && terminals.length === 0) {
    failures.push(`${label} missing completed tool lifecycle`);
  }
  if (
    requirePayload &&
    ![...startsByCallId.values()].some((event) => hasPayloadValue(event.data?.input))
  ) {
    failures.push(`${label} tool starts missing input payload`);
  }
  if (
    requirePayload &&
    !terminals.some((event) => hasPayloadValue(event.data?.output))
  ) {
    failures.push(`${label} tool terminals missing output payload`);
  }

  return {
    failures,
    tools,
    startsByCallId,
    terminals,
  };
}

function reconstructFinalFromSegments(events) {
  const segments = new Map();
  let hasFinalText = false;
  let result = "";
  for (const event of events) {
    if (event?.event !== "assistant.segment" || event.data?.role !== "final") {
      continue;
    }
    const segmentId = event.data?.segmentId;
    if (typeof segmentId !== "string" || !segmentId) continue;
    const previous = segments.get(segmentId) ?? { text: "", forwardedLength: 0 };
    if (typeof event.data?.text === "string") previous.text += event.data.text;
    const chunk = previous.text.slice(previous.forwardedLength);
    if (chunk) {
      if (previous.forwardedLength === 0 && hasFinalText) result += "\n\n";
      result += chunk;
      previous.forwardedLength = previous.text.length;
      hasFinalText = true;
    }
    segments.set(segmentId, previous);
  }
  return result;
}

function check(events) {
  const names = events.map((e) => e.event);
  const has = (n) => names.includes(n);
  const failures = [];

  if (!has("run.started")) failures.push("missing run.started");
  const started = events.find((e) => e.event === "run.started");
  if (started?.data?.orchestrationMode !== "hybrid-steer") {
    failures.push(
      `run.started orchestrationMode expected hybrid-steer, got ${started?.data?.orchestrationMode}`,
    );
  }
  if (!Array.isArray(started?.data?.catalogSlugs) || started.data.catalogSlugs.length < 1) {
    failures.push("run.started missing catalogSlugs");
  }
  if (!has("run.finished") && !has("run.error") && !has("run.cancelled")) {
    failures.push("missing terminal event (finished/error/cancelled)");
  }
  if (has("run.error")) {
    const err = events.find((e) => e.event === "run.error");
    failures.push(`run.error: ${JSON.stringify(err?.data)}`);
  }
  const messageDeltas = events.filter((event) => event.event === "message.delta");
  const compatibilityDeltas = messageDeltas.filter(
    (event) => event.data?.compatibility === "assistant.segment",
  );
  const assistantSegments = events.filter(
    (event) => event.event === "assistant.segment",
  );
  const hasDelta = messageDeltas.length > 0;
  const hasAssistantSegment = assistantSegments.length > 0;
  const hasTool =
    names.includes("tool.progress") ||
    names.some((n) => n.startsWith("part.")) ||
    names.includes("todo.update");
  if (!hasDelta && !has("run.finished")) {
    failures.push("no message.delta before end");
  }
  if (has("run.finished") && !hasAssistantSegment) {
    failures.push("completed run missing assistant.segment");
  }
  if (hasAssistantSegment && compatibilityDeltas.length === 0) {
    failures.push("assistant.segment missing compatibility message.delta");
  }

  const sequence = checkStreamSequence(events, "SSE", { requireAll: true });
  failures.push(...sequence.failures);
  const toolLifecycle = checkToolLifecycle(
    events,
    "SSE",
    requireTool,
    requireToolPayload,
  );
  failures.push(...toolLifecycle.failures);

  const compatibilityText = compatibilityDeltas
    .map((event) =>
      typeof event.data?.content === "string" ? event.data.content : "",
    )
    .join("");
  const canonicalOutput = events.find(
    (event) => event.event === "canonical.output",
  )?.data?.canonicalOutput;
  const canonicalText = canonicalOutput?.finalAnswer?.markdown;
  if (
    compatibilityText &&
    typeof canonicalText === "string" &&
    compatibilityText !== canonicalText
  ) {
    failures.push("compatibility delta text differs from canonical final answer");
  }
  const reconstructedFinal = reconstructFinalFromSegments(events);
  if (
    reconstructedFinal &&
    typeof canonicalText === "string" &&
    reconstructedFinal !== canonicalText
  ) {
    failures.push("assistant.segment reconstruction differs from canonical final answer");
  }

  return {
    ok: failures.length === 0,
    failures,
    summary: {
      eventCount: events.length,
      uniqueEvents: [...new Set(names)],
      hasDelta,
      hasAssistantSegment,
      compatibilityDeltaCount: compatibilityDeltas.length,
      hasTool,
      actionableToolCount: toolLifecycle.tools.length,
      completedToolCount: toolLifecycle.terminals.length,
      streamSeqCount: sequence.seqs.length,
      finished: has("run.finished"),
    },
  };
}

async function checkPersistence(events, sessionId) {
  const failures = [];
  const runId = events.find((event) => event.event === "run.accepted")?.data?.runId;
  if (typeof runId !== "string" || !runId) {
    return { failures: ["run.accepted missing runId"], summary: {} };
  }

  const [runEventsResponse, runResponse, sessionResponse] = await Promise.all([
    getJson(`/v1/runs/${encodeURIComponent(runId)}/events`),
    getJson(`/v1/runs/${encodeURIComponent(runId)}`),
    getJson(`/v1/sessions/${encodeURIComponent(sessionId)}/messages`),
  ]);
  const runEvents = Array.isArray(runEventsResponse.body?.items)
    ? runEventsResponse.body.items
    : [];
  const persistedDeltas = runEvents.filter(
    (event) => event?.type === "message.delta",
  );
  const persistedSegments = runEvents.filter(
    (event) => event?.type === "assistant.segment",
  );
  if (!runEventsResponse.ok) failures.push("failed to load persisted run events");
  if (!runResponse.ok) failures.push("failed to load persisted run record");
  if (persistedSegments.length === 0) {
    failures.push("persisted run events missing assistant.segment");
  }
  if (persistedDeltas.length > 0) {
    failures.push("compatibility message.delta leaked into persisted run events");
  }

  const persistedSequence = checkStreamSequence(
    runEvents.map((event) => ({ event: event.type, data: event })),
    "Run Events",
    { requireAll: true },
  );
  failures.push(...persistedSequence.failures);
  const wireSequence = checkStreamSequence(events, "SSE");
  if (JSON.stringify(wireSequence.seqs) !== JSON.stringify(persistedSequence.seqs)) {
    failures.push("SSE and persisted Run Events streamSeq differ");
  }

  const persistedToolLifecycle = checkToolLifecycle(
    runEvents.map((event) => ({ event: event.type, data: event })),
    "Run Events",
    requireTool,
    requireToolPayload,
  );
  failures.push(...persistedToolLifecycle.failures);

  if (requireTool) {
    const wireTools = events.filter(isActionableTool);
    for (const wireEvent of wireTools) {
      const persistedEvent = runEvents.find(
        (event) =>
          event?.type === "tool.progress" &&
          event.callId === wireEvent.data?.callId &&
          Boolean(isTerminalToolStatus(event.status)) ===
            Boolean(isTerminalToolStatus(wireEvent.data?.status)),
      );
      if (!persistedEvent) {
        failures.push(`Run Events missing SSE tool lifecycle event ${wireEvent.data?.callId}`);
        continue;
      }
      if (JSON.stringify(persistedEvent.input) !== JSON.stringify(wireEvent.data?.input)) {
        failures.push(`persisted tool input differs for ${wireEvent.data?.callId}`);
      }
      if (JSON.stringify(persistedEvent.output) !== JSON.stringify(wireEvent.data?.output)) {
        failures.push(`persisted tool output differs for ${wireEvent.data?.callId}`);
      }
    }
  }

  const canonicalOutput = events.find(
    (event) => event.event === "canonical.output",
  )?.data?.canonicalOutput;
  const canonicalText = canonicalOutput?.finalAnswer?.markdown;
  const assistantMessage = Array.isArray(sessionResponse.body?.messages)
    ? sessionResponse.body.messages.find(
        (message) => message?.role === "assistant" && message?.runId === runId,
      )
    : undefined;
  if (!sessionResponse.ok) failures.push("failed to load persisted session");
  if (!assistantMessage) {
    failures.push("persisted session missing assistant message");
  } else if (
    typeof canonicalText === "string" &&
    assistantMessage.content !== canonicalText
  ) {
    failures.push("persisted assistant content differs from canonical final answer");
  }

  const persistedCanonical = runEvents.find(
    (event) => event?.type === "canonical.output",
  )?.canonicalOutput;
  if (JSON.stringify(persistedCanonical) !== JSON.stringify(canonicalOutput)) {
    failures.push("persisted canonical.output differs from SSE canonical.output");
  }
  if (JSON.stringify(runResponse.body?.canonicalOutput) !== JSON.stringify(canonicalOutput)) {
    failures.push("Run record canonicalOutput differs from SSE canonical.output");
  }
  if (JSON.stringify(assistantMessage?.canonicalOutput) !== JSON.stringify(canonicalOutput)) {
    failures.push("Session canonicalOutput differs from SSE canonical.output");
  }
  const reconstructedFinal = reconstructFinalFromSegments(
    runEvents.map((event) => ({ event: event.type, data: event })),
  );
  if (
    reconstructedFinal &&
    typeof canonicalText === "string" &&
    reconstructedFinal !== canonicalText
  ) {
    failures.push("persisted timeline reconstruction differs from canonical final answer");
  }

  return {
    failures,
    summary: {
      runId,
      persistedEventCount: runEvents.length,
      persistedSegmentCount: persistedSegments.length,
      persistedDeltaCount: persistedDeltas.length,
      persistedToolCount: persistedToolLifecycle.tools.length,
      persistedStreamSeqCount: persistedSequence.seqs.length,
      timelineMatchesSse:
        JSON.stringify(wireSequence.seqs) === JSON.stringify(persistedSequence.seqs),
      persistedAssistantMatchesCanonical:
        typeof canonicalText === "string" &&
        assistantMessage?.content === canonicalText,
    },
  };
}

async function main() {
  const tag = `[smoke:${agentId}]`;
  console.log(`${tag} base=${base} timeout=${timeoutSec}s mode=${mode} skill=${processSkill}${requireTool ? " requireTool=true" : ""}${requireToolPayload ? " requireToolPayload=true" : ""}${soft ? " soft=true" : ""}`);

  const health = await getJson("/v1/health");
  if (!health.ok || health.body?.runMode !== "cli") {
    console.error(`${tag} FAIL health`, health);
    process.exit(1);
  }
  console.log(`${tag} OK health runMode=cli`);

  const agents = await getJson("/v1/agents");
  const target = agents.body?.agents?.find((a) => a.agentId === agentId);
  if (!agents.ok || target?.status !== "available") {
    const msg = `agent ${agentId} not available: status=${target?.status ?? "missing"}`;
    if (soft) {
      console.warn(`${tag} SKIP ${msg} (--soft)`);
      process.exit(0);
    }
    console.error(`${tag} FAIL ${msg}`, target ?? agents.body);
    process.exit(1);
  }
  console.log(`${tag} OK ${agentId}`, target.version ?? "(no version)");

  console.log(`${tag} POST /v1/runs (short prompt, may take up to ${timeoutSec}s)…`);
  let run;
  try {
    run = await runSse();
  } catch (e) {
    console.error(`${tag} FAIL run`, e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const { events, sessionId } = run;
  const result = check(events);
  const persistence = await checkPersistence(events, sessionId);
  result.failures.push(...persistence.failures);
  result.ok = result.failures.length === 0;
  console.log(`${tag} events:`, result.summary);
  console.log(`${tag} persistence:`, persistence.summary);

  if (!result.ok) {
    console.error(`${tag} FAIL`, result.failures);
    process.exit(1);
  }
  console.log(`${tag} PASS companion SSE loop`);
}

main();
