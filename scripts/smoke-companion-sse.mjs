#!/usr/bin/env node
/**
 * S1.0 / S1.2 冒烟：Companion 健康 + 短 Run SSE 事件集。
 * 用法：node scripts/smoke-companion-sse.mjs [--base http://127.0.0.1:9477] [--timeout 120]
 */
const base =
  process.argv.find((a, i) => process.argv[i - 1] === "--base") ??
  process.env.COMPANION_BASE_URL ??
  "http://127.0.0.1:9477";
const timeoutSec = Number(
  process.argv.find((a, i) => process.argv[i - 1] === "--timeout") ?? "120",
);

async function getJson(path) {
  const res = await fetch(`${base}${path}`);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
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
  const body = {
    sessionId: `smoke-${Date.now()}`,
    projectId: "none",
    workspaceProjectId: "sandbox-default",
    moduleId: "chat",
    binding: { moduleId: "chat", mode: "fast" },
    agentId: "codex",
    agentModel: "default",
    messages: [{ role: "user", content: "只回复一个字：好。不要解释。" }],
    useClientHistory: false,
    processSkill: "skill-qa-fast",
    platformNormSkill: "skill-platform-research-norms",
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSec * 1000);

  const res = await fetch(`${base}/v1/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  clearTimeout(timer);

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`POST /v1/runs ${res.status}: ${errText.slice(0, 400)}`);
  }

  const text = await res.text();
  return parseSseEvents(text);
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
  const hasDelta = names.some((n) => n === "message.delta");
  const hasTool =
    names.includes("tool.progress") ||
    names.some((n) => n.startsWith("part.")) ||
    names.includes("todo.update");
  if (!hasDelta && !has("run.finished")) {
    failures.push("no message.delta before end");
  }

  return {
    ok: failures.length === 0,
    failures,
    summary: {
      eventCount: events.length,
      uniqueEvents: [...new Set(names)],
      hasDelta,
      hasTool,
      finished: has("run.finished"),
    },
  };
}

async function main() {
  console.log(`[smoke] base=${base} timeout=${timeoutSec}s`);

  const health = await getJson("/v1/health");
  if (!health.ok || health.body?.runMode !== "cli") {
    console.error("[smoke] FAIL health", health);
    process.exit(1);
  }
  console.log("[smoke] OK health runMode=cli");

  const agents = await getJson("/v1/agents");
  const codex = agents.body?.agents?.find((a) => a.agentId === "codex");
  if (!agents.ok || codex?.status !== "available") {
    console.error("[smoke] FAIL codex not available", agents.body);
    process.exit(1);
  }
  console.log("[smoke] OK codex", codex.version);

  console.log("[smoke] POST /v1/runs (short prompt, may take up to", timeoutSec, "s)…");
  let events;
  try {
    events = await runSse();
  } catch (e) {
    console.error("[smoke] FAIL run", e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const result = check(events);
  console.log("[smoke] events:", result.summary);

  if (!result.ok) {
    console.error("[smoke] FAIL", result.failures);
    process.exit(1);
  }
  console.log("[smoke] PASS companion SSE loop");
}

main();
