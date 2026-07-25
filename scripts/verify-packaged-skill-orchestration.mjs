#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const args = new Map(
  process.argv.slice(2).map((item) => {
    const [key, ...value] = item.replace(/^--/, "").split("=");
    return [key, value.join("=")];
  }),
);

async function defaultMacApp() {
  const releaseDir = join(repoRoot, "apps", "desktop", "release", "mac-arm64");
  const entries = await readdir(releaseDir, { withFileTypes: true });
  const app = entries.find((entry) => entry.isDirectory() && entry.name.endsWith(".app"));
  assert(app, `packaged app not found in ${releaseDir}`);
  return join(releaseDir, app.name);
}

async function resolveLayout() {
  if (process.platform === "darwin") {
    const appPath = resolve(args.get("app") || (await defaultMacApp()));
    const productName = basename(appPath, ".app");
    return {
      platform: "darwin",
      appPath,
      resourcesDir: join(appPath, "Contents", "Resources"),
      runtimePath: join(
        appPath,
        "Contents",
        "Frameworks",
        `${productName} Helper.app`,
        "Contents",
        "MacOS",
        `${productName} Helper`,
      ),
    };
  }

  let resourcesDir = args.get("resources");
  let runtimePath = args.get("runtime");
  if (!resourcesDir || !runtimePath) {
    const unpackedDir = resolve(
      args.get("unpacked") ||
        join(
          repoRoot,
          "apps",
          "desktop",
          "release",
          process.platform === "win32" ? "win-unpacked" : "linux-unpacked",
        ),
    );
    const entries = await readdir(unpackedDir, { withFileTypes: true });
    const executable = entries.find(
      (entry) =>
        entry.isFile() &&
        (process.platform === "win32"
          ? entry.name.toLowerCase().endsWith(".exe") &&
            !entry.name.toLowerCase().includes("uninstall")
          : !entry.name.includes(".")),
    );
    assert(executable, `packaged executable not found in ${unpackedDir}`);
    resourcesDir = join(unpackedDir, "resources");
    runtimePath = join(unpackedDir, executable.name);
  }
  return {
    platform: process.platform,
    appPath: null,
    resourcesDir: resolve(resourcesDir),
    runtimePath: resolve(runtimePath),
  };
}

async function fileExists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

async function verifyResources(layout) {
  const registryPath = join(
    layout.resourcesDir,
    "skills",
    "skill-registry.generated.json",
  );
  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  assert.equal(registry.registryVersion, "0.1.7-v1");
  assert.equal(registry.selectorVersion, "0.1.7-v1");
  assert.equal(registry.skills.length, 48);
  assert.equal(
    registry.skills.filter((item) => item.status === "active").length,
    44,
  );
  assert.equal(
    registry.skills.filter((item) => item.status === "disabled").length,
    4,
  );
  for (const skill of registry.skills.filter((item) => item.status === "active")) {
    assert.equal(
      await fileExists(join(layout.resourcesDir, "skills", skill.slug, "SKILL.md")),
      true,
      `missing packaged Skill ${skill.slug}`,
    );
  }

  const requiredPaths = [
    join(layout.resourcesDir, "companion", "companion.cjs"),
    join(layout.resourcesDir, "prompts", "platform", "base-chat.md"),
    join(
      layout.resourcesDir,
      "web-standalone",
      "web",
      "public",
      "openscad-wasm",
      "openscad.js",
    ),
    join(
      layout.resourcesDir,
      "web-standalone",
      "web",
      "public",
      "openscad-wasm",
      "openscad.wasm",
    ),
  ];
  for (const path of requiredPaths) {
    assert.equal(await fileExists(path), true, `missing packaged resource ${path}`);
  }

  const enginePlatform = layout.platform === "win32" ? "win32" : layout.platform;
  const runtimeRoot = join(
    layout.resourcesDir,
    "engines",
    "openscad",
    enginePlatform,
  );
  const runtimeManifest = JSON.parse(
    await readFile(join(runtimeRoot, "RUNTIME_MANIFEST.json"), "utf8"),
  );
  const licensesDir = join(runtimeRoot, "LICENSES");
  const licenseFiles = await readdir(licensesDir);
  assert(licenseFiles.includes("LICENSE"), "OpenSCAD LICENSE missing");
  assert(
    licenseFiles.includes("SOURCE_AVAILABILITY.md"),
    "OpenSCAD source availability notice missing",
  );
  assert(
    licenseFiles.includes("THIRD_PARTY_NOTICES.md"),
    "OpenSCAD third-party notices missing",
  );

  return {
    registryVersion: registry.registryVersion,
    selectorVersion: registry.selectorVersion,
    skillCount: registry.skills.length,
    activeSkillCount: registry.skills.filter((item) => item.status === "active")
      .length,
    disabledSkillCount: registry.skills.filter(
      (item) => item.status === "disabled",
    ).length,
    runtimeVersion: runtimeManifest.version ?? null,
    licenseFileCount: licenseFiles.length,
  };
}

async function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert(address && typeof address === "object");
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolvePort(port)));
    });
  });
}

async function waitForHealth(baseUrl, expectedVersion, child, logs) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    assert.equal(child.exitCode, null, `packaged Companion exited early\n${logs.join("")}`);
    try {
      const response = await fetch(`${baseUrl}/v1/health`, {
        signal: AbortSignal.timeout(750),
      });
      if (response.ok) {
        const health = await response.json();
        assert.equal(health.ok, true);
        assert.equal(health.version, expectedVersion);
        assert.equal(health.runMode, "simulate");
        return health;
      }
    } catch {
      // The packaged sidecar is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`packaged Companion health timeout\n${logs.join("")}`);
}

async function startCompanion(layout, dataDir, expectedVersion, v2Enabled) {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const logs = [];
  const child = spawn(
    layout.runtimePath,
    [join(layout.resourcesDir, "companion", "companion.cjs")],
    {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        COMPANION_HOST: "127.0.0.1",
        COMPANION_PORT: String(port),
        COMPANION_DATA_DIR: dataDir,
        COMPANION_RUN_MODE: "simulate",
        COMPANION_CLI_FALLBACK: "error",
        COMPANION_LOG_LEVEL: "error",
        SKILL_ORCHESTRATION_V2_ENABLED: v2Enabled ? "true" : "false",
        JLC_SKILLS_DIR: join(layout.resourcesDir, "skills"),
        JLC_PROMPTS_DIR: join(layout.resourcesDir, "prompts"),
        JLC_OPENSCAD_RESOURCES_DIR: join(
          layout.resourcesDir,
          "engines",
          "openscad",
        ),
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  child.stdout?.on("data", (chunk) => logs.push(chunk.toString("utf8")));
  child.stderr?.on("data", (chunk) => logs.push(chunk.toString("utf8")));
  const health = await waitForHealth(baseUrl, expectedVersion, child, logs);
  return { child, baseUrl, health, logs };
}

async function stopCompanion(instance) {
  if (instance.child.exitCode !== null) return;
  instance.child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolveExit) => instance.child.once("exit", resolveExit)),
    new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
  ]);
  if (instance.child.exitCode === null) instance.child.kill("SIGKILL");
}

async function jsonRequest(baseUrl, path, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => null);
  assert.equal(response.ok, true, `${path} failed: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

function runRequest(name, extra = {}) {
  return {
    sessionId: `packaged-${name}`,
    projectId: "none",
    workspaceProjectId: "__lazy_default__",
    lazyDefaultWorkspace: {
      moduleId: "chat",
      taskId: `packaged-${name}`,
      taskTitle: "Packaged Skill acceptance",
    },
    moduleId: "chat",
    binding: { moduleId: "chat", mode: "auto" },
    agentId: "codex",
    agentModel: "default",
    messages: [
      {
        id: `message-${name}`,
        role: "user",
        content: extra.requestedSkillSlug ? "Please run industry research" : "hello",
      },
    ],
    useClientHistory: true,
    ...extra,
  };
}

async function executeRun(baseUrl, name, extra) {
  const response = await fetch(`${baseUrl}/v1/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(runRequest(name, extra)),
    signal: AbortSignal.timeout(30_000),
  });
  const runId = response.headers.get("x-jlc-run-id");
  const stream = await response.text();
  assert.equal(response.ok, true);
  assert(runId, `${name}: missing run id`);
  assert(stream.includes("event: run.finished"), `${name}: missing run.finished`);
  const record = await jsonRequest(baseUrl, `/v1/runs/${runId}`);
  const eventRecord = await jsonRequest(baseUrl, `/v1/runs/${runId}/events`);
  return { runId, record, events: eventRecord.items };
}

function summarizeRun(result) {
  const started = result.events.find((event) => event.type === "run.started");
  return {
    runId: result.runId,
    decisionOutcome: result.record.skillDecision?.decisionOutcome ?? null,
    selectionSource: result.record.skillDecision?.selectionSource ?? null,
    primarySkillSlug: result.record.skillDecision?.primarySkillSlug ?? null,
    orchestrationMode: started?.orchestrationMode ?? null,
    injectedSkills: started?.injectedSkills ?? [],
    catalogEntries: started?.catalogSlugs?.length ?? 0,
    skillEvents: result.events
      .filter((event) => event.type.startsWith("skill."))
      .map((event) => event.type),
  };
}

const layout = await resolveLayout();
const rootPackage = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));
const expectedVersion = args.get("expected-version") || rootPackage.version;
const reportPath = resolve(
  args.get("report") ||
    join(
      repoRoot,
      "output",
      "skill-orchestration-0.1.7",
      "packaged-runtime-report.json",
    ),
);
const dataDir = await mkdtemp(join(tmpdir(), "jlc-packaged-skill-acceptance-"));
const sentinel = join(dataDir, "upgrade-sentinel.txt");
const sentinelValue = `preserve-${Date.now()}`;
await writeFile(sentinel, sentinelValue, "utf8");

let activeInstance = null;
try {
  const resources = await verifyResources(layout);

  activeInstance = await startCompanion(layout, dataDir, expectedVersion, true);
  const v2Health = activeInstance.health;
  const none = await executeRun(activeInstance.baseUrl, "v2-none");
  const selected = await executeRun(activeInstance.baseUrl, "v2-selected", {
    requestedSkillSlug: "skill-wr-industry",
  });
  assert.equal(none.record.skillDecision?.decisionOutcome, "none");
  assert.deepEqual(summarizeRun(none).skillEvents, []);
  assert.equal(selected.record.skillDecision?.decisionOutcome, "selected");
  assert.equal(selected.record.skillDecision?.primarySkillSlug, "skill-wr-industry");
  assert.deepEqual(summarizeRun(selected).skillEvents, [
    "skill.selected",
    "skill.ready",
  ]);
  const historyMessages = [
    { id: "history-user", role: "user", content: "preserve this message" },
    { id: "history-assistant", role: "assistant", content: "preserved" },
  ];
  await jsonRequest(activeInstance.baseUrl, "/v1/sessions/packaged-history/messages", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectId: "none", messages: historyMessages }),
  });
  await stopCompanion(activeInstance);
  activeInstance = null;

  activeInstance = await startCompanion(layout, dataDir, expectedVersion, false);
  const rollbackHealth = activeInstance.health;
  const noneAfterRollback = await jsonRequest(
    activeInstance.baseUrl,
    `/v1/runs/${none.runId}`,
  );
  const selectedAfterRollback = await jsonRequest(
    activeInstance.baseUrl,
    `/v1/runs/${selected.runId}`,
  );
  assert.equal(noneAfterRollback.skillDecision?.decisionOutcome, "none");
  assert.equal(selectedAfterRollback.skillDecision?.decisionOutcome, "selected");
  const historyAfterRollback = await jsonRequest(
    activeInstance.baseUrl,
    "/v1/sessions/packaged-history/messages",
  );
  assert.deepEqual(historyAfterRollback.messages, historyMessages);
  assert.equal(await readFile(sentinel, "utf8"), sentinelValue);

  const legacy = await executeRun(activeInstance.baseUrl, "legacy", {
    processSkill: "skill-qa",
    platformNormSkill: "skill-platform-research-norms",
  });
  const legacySummary = summarizeRun(legacy);
  assert.equal(legacy.record.skillDecision, undefined);
  assert.equal(legacySummary.orchestrationMode, "hybrid-steer");
  assert.deepEqual(legacySummary.injectedSkills, [
    "skill-platform-research-norms",
    "skill-qa",
  ]);
  assert.equal(legacySummary.catalogEntries, 22);
  assert.deepEqual(legacySummary.skillEvents, []);
  await stopCompanion(activeInstance);
  activeInstance = null;

  activeInstance = await startCompanion(layout, dataDir, expectedVersion, true);
  const v2AgainHealth = activeInstance.health;
  const legacyAfterV2 = await jsonRequest(
    activeInstance.baseUrl,
    `/v1/runs/${legacy.runId}`,
  );
  assert.equal(legacyAfterV2.skillDecision, undefined);
  assert.equal(await readFile(sentinel, "utf8"), sentinelValue);
  await stopCompanion(activeInstance);
  activeInstance = null;

  const report = {
    ok: true,
    generatedAt: new Date().toISOString(),
    expectedVersion,
    platform: layout.platform,
    appPath: layout.appPath,
    resourcesDir: layout.resourcesDir,
    resources,
    v2: {
      health: v2Health,
      none: summarizeRun(none),
      selected: summarizeRun(selected),
    },
    rollback: {
      health: rollbackHealth,
      historyMessagesPreserved: true,
      v2RunsPreserved: true,
      dataSentinelPreserved: true,
      legacy: legacySummary,
    },
    v2RoundTrip: {
      health: v2AgainHealth,
      legacyRunReadable: true,
      dataSentinelPreserved: true,
    },
  };
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (activeInstance) await stopCompanion(activeInstance);
  if (!args.has("keep-data")) {
    await rm(dataDir, { recursive: true, force: true });
  }
}
