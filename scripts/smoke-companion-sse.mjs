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
  const body = {
    sessionId: `smoke-${agentId}-${Date.now()}`,
    projectId: "none",
    workspaceProjectId: "sandbox-default",
    moduleId: "chat",
    binding: { moduleId: "chat", mode },
    agentId,
    agentModel: "default",
    messages: [{ role: "user", content: "只回复一个字：好。不要解释。" }],
    useClientHistory: false,
    processSkill,
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
  const tag = `[smoke:${agentId}]`;
  console.log(`${tag} base=${base} timeout=${timeoutSec}s mode=${mode} skill=${processSkill}${soft ? " soft=true" : ""}`);

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
  let events;
  try {
    events = await runSse();
  } catch (e) {
    console.error(`${tag} FAIL run`, e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const result = check(events);
  console.log(`${tag} events:`, result.summary);

  if (!result.ok) {
    console.error(`${tag} FAIL`, result.failures);
    process.exit(1);
  }
  console.log(`${tag} PASS companion SSE loop`);
}

main();
