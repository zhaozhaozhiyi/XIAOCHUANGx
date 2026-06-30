#!/usr/bin/env node
/**
 * MVP 守门：要求 Companion 至少有一个目标 CLI 处于 available。
 *
 * 与 smoke:companion:codex / smoke:companion:claude（均 --soft）配合：
 * 它们对"未安装"宽容退出 0，避免任一 CLI 缺失就阻塞另一条路径；
 * 但 mvp:verify 不能在两条都没装时静默通过——本脚本兜底。
 */
const base = process.env.COMPANION_BASE_URL ?? "http://127.0.0.1:9477";
const REQUIRED = ["codex", "claude"];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url) {
  let lastError = null;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      return await fetch(url);
    } catch (error) {
      lastError = error;
      await sleep(500);
    }
  }
  throw lastError;
}

async function main() {
  const res = await fetchWithRetry(`${base}/v1/agents`).catch((e) => {
    console.error(`[mvp:any] FAIL Companion 不可达 ${base}: ${e.message}`);
    process.exit(1);
  });
  if (!res.ok) {
    console.error(`[mvp:any] FAIL /v1/agents HTTP ${res.status}`);
    process.exit(1);
  }
  const body = await res.json();
  const list = Array.isArray(body?.agents) ? body.agents : [];
  const summary = REQUIRED.map((id) => {
    const a = list.find((x) => x.agentId === id);
    return { agentId: id, status: a?.status ?? "missing", version: a?.version ?? null };
  });
  const ok = summary.some((s) => s.status === "available");
  console.log("[mvp:any]", JSON.stringify(summary));
  if (!ok) {
    console.error(`[mvp:any] FAIL ${REQUIRED.join("/")} 全部不可用，至少需要一个 CLI 通过真流冒烟`);
    process.exit(1);
  }
  console.log("[mvp:any] PASS 至少一个目标 CLI 可用");
}

main();
