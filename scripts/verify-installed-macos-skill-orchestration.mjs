#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rm,
  writeFile,
} from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createServer } from "node:net";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const args = new Map(
  process.argv.slice(2).map((item) => {
    const [key, ...value] = item.replace(/^--/, "").split("=");
    return [key, value.join("=")];
  }),
);

assert.equal(process.platform, "darwin", "macOS installed acceptance requires macOS");

const baselineApp = resolve(args.get("baseline-app") || "/Applications/小窗.app");
const candidateDmg = resolve(
  args.get("candidate-dmg") ||
    join(repoRoot, "apps", "desktop", "release", "小窗-macos-0.1.7.dmg"),
);
const expectedCandidateVersion = args.get("expected-version") || "0.1.7";
const reportPath = resolve(
  args.get("report") ||
    join(
      repoRoot,
      "output",
      "skill-orchestration-0.1.7",
      "installed-macos-report.json",
    ),
);
const tempRoot = await mkdtemp(join(tmpdir(), "jlc-installed-macos-acceptance-"));
const mountPoint = join(tempRoot, "dmg");
const installRoot = join(tempRoot, "Applications");
const candidateApp = join(installRoot, "小窗.app");
const companionDataDir = join(tempRoot, "companion-data");
const electronUserDataDir = join(tempRoot, "electron-user-data");
const workspaceRoot = join(tempRoot, "workspaces");
const deliverablesRoot = join(tempRoot, "deliverables");
const logsRoot = join(tempRoot, "logs");
let mounted = false;
let activeDesktop = null;

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function runCommand(command, commandArgs, options = {}) {
  const result = await execFileAsync(command, commandArgs, {
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  });
  return {
    stdout: result.stdout?.toString("utf8") ?? "",
    stderr: result.stderr?.toString("utf8") ?? "",
  };
}

async function sha256File(path) {
  const hash = createHash("sha256");
  await new Promise((resolveHash, rejectHash) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", rejectHash);
    stream.on("end", resolveHash);
  });
  return hash.digest("hex");
}

async function snapshotTree(root) {
  if (!(await pathExists(root))) {
    return { exists: false, digest: null, files: 0, bytes: 0 };
  }

  const hash = createHash("sha256");
  let files = 0;
  let bytes = 0;

  async function visit(path, relativePath) {
    const info = await lstat(path);
    if (info.isSymbolicLink()) {
      hash.update(`L\0${relativePath}\0${await readlink(path)}\0`);
      return;
    }
    if (info.isDirectory()) {
      hash.update(`D\0${relativePath}\0`);
      const entries = await readdir(path, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
      for (const entry of entries) {
        await visit(join(path, entry.name), join(relativePath, entry.name));
      }
      return;
    }
    if (info.isFile()) {
      files += 1;
      bytes += info.size;
      hash.update(`F\0${relativePath}\0${info.size}\0`);
      await new Promise((resolveHash, rejectHash) => {
        const stream = createReadStream(path);
        stream.on("data", (chunk) => hash.update(chunk));
        stream.on("error", rejectHash);
        stream.on("end", resolveHash);
      });
      hash.update("\0");
      return;
    }
    hash.update(`O\0${relativePath}\0${info.mode}\0`);
  }

  await visit(root, ".");
  return { exists: true, digest: hash.digest("hex"), files, bytes };
}

async function snapshotProtectedUserData() {
  const userHome = homedir();
  const roots = [
    join(userHome, "Library", "Application Support", "小窗"),
    join(userHome, ".jlcresearch"),
    join(userHome, "Library", "Application Support", "@jlc"),
  ];
  const result = {};
  for (const root of roots) {
    result[root] = await snapshotTree(root);
  }
  return result;
}

async function appVersion(appPath) {
  const result = await runCommand("/usr/bin/plutil", [
    "-extract",
    "CFBundleShortVersionString",
    "raw",
    "-o",
    "-",
    join(appPath, "Contents", "Info.plist"),
  ]);
  return result.stdout.trim();
}

async function verifySignature(appPath) {
  await runCommand("/usr/bin/codesign", [
    "--verify",
    "--deep",
    "--strict",
    "--verbose=2",
    appPath,
  ]);
  return true;
}

async function candidateResources(appPath) {
  const resourcesDir = join(appPath, "Contents", "Resources");
  const registry = JSON.parse(
    await readFile(join(resourcesDir, "skills", "skill-registry.generated.json"), "utf8"),
  );
  assert.equal(registry.registryVersion, "0.1.7-v1");
  assert.equal(registry.selectorVersion, "0.1.7-v1");
  assert.equal(registry.skills.length, 48);
  assert.equal(registry.skills.filter((item) => item.status === "active").length, 44);
  assert.equal(registry.skills.filter((item) => item.status === "disabled").length, 4);
  assert.equal(
    await pathExists(join(resourcesDir, "companion", "companion.cjs")),
    true,
  );
  assert.equal(
    await pathExists(join(resourcesDir, "prompts", "platform", "base-chat.md")),
    true,
  );
  for (const skill of registry.skills.filter((item) => item.status === "active")) {
    assert.equal(
      await pathExists(join(resourcesDir, "skills", skill.slug, "SKILL.md")),
      true,
      `missing installed Skill ${skill.slug}`,
    );
  }
  return {
    registryVersion: registry.registryVersion,
    selectorVersion: registry.selectorVersion,
    skillCount: registry.skills.length,
    activeSkillCount: registry.skills.filter((item) => item.status === "active").length,
    disabledSkillCount: registry.skills.filter((item) => item.status === "disabled").length,
  };
}

async function freePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.once("error", rejectPort);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert(address && typeof address === "object");
      const port = address.port;
      server.close((error) => (error ? rejectPort(error) : resolvePort(port)));
    });
  });
}

async function pidsListeningOn(port) {
  try {
    const result = await runCommand("/usr/sbin/lsof", [
      "-nP",
      `-iTCP:${port}`,
      "-sTCP:LISTEN",
      "-t",
    ]);
    return result.stdout
      .split(/\s+/)
      .map(Number)
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === 1) {
      return [];
    }
    throw error;
  }
}

async function stopOwnedPortProcesses(ports, appPath) {
  const pids = new Set();
  for (const port of ports) {
    for (const pid of await pidsListeningOn(port)) pids.add(pid);
  }
  for (const pid of pids) {
    let command = "";
    try {
      command = (
        await runCommand("/bin/ps", ["-p", String(pid), "-o", "command="])
      ).stdout.trim();
    } catch {
      continue;
    }
    assert(
      command.includes(`${appPath}/Contents/`),
      `refusing to stop unrelated pid ${pid} on isolated acceptance port: ${command}`,
    );
    try {
      process.kill(pid, "SIGTERM");
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ESRCH") {
        throw error;
      }
    }
  }
}

async function waitForHealth(baseUrl, expectedVersion, child, logs) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    assert.equal(child.exitCode, null, `desktop exited early\n${logs.join("")}`);
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
      // Desktop is still starting its packaged Companion.
    }
    await delay(100);
  }
  throw new Error(`desktop Companion health timeout\n${logs.join("")}`);
}

async function waitForWeb(baseUrl, child, logs) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    assert.equal(child.exitCode, null, `desktop exited early\n${logs.join("")}`);
    try {
      const response = await fetch(`${baseUrl}/api/app/identity`, {
        signal: AbortSignal.timeout(750),
      });
      if (response.ok) {
        const body = await response.json();
        assert.equal(body.appId, "xiaochuang");
        return body;
      }
    } catch {
      // Embedded Web is still starting.
    }
    await delay(100);
  }
  throw new Error(`desktop embedded Web timeout\n${logs.join("")}`);
}

async function startDesktop(appPath, label, expectedVersion, v2Enabled) {
  const companionPort = await freePort();
  const webPort = await freePort();
  assert.deepEqual(await pidsListeningOn(companionPort), []);
  assert.deepEqual(await pidsListeningOn(webPort), []);
  const logs = [];
  let logChars = 0;
  const appendLog = (chunk) => {
    if (logChars >= 200_000) return;
    const text = chunk.toString("utf8");
    logs.push(text);
    logChars += text.length;
  };
  const child = spawn(
    join(appPath, "Contents", "MacOS", basename(appPath, ".app")),
    [`--user-data-dir=${electronUserDataDir}`, "--no-first-run"],
    {
      env: {
        ...process.env,
        COMPANION_HOST: "127.0.0.1",
        COMPANION_PORT: String(companionPort),
        COMPANION_BASE_URL: `http://127.0.0.1:${companionPort}`,
        COMPANION_DATA_DIR: companionDataDir,
        COMPANION_RUN_MODE: "simulate",
        COMPANION_CLI_FALLBACK: "error",
        COMPANION_LOG_LEVEL: "error",
        JLC_DEFAULT_WORKSPACE_ROOT: workspaceRoot,
        JLC_DESKTOP_WEB_PORT: String(webPort),
        SKILL_ORCHESTRATION_V2_ENABLED: v2Enabled ? "true" : "false",
        NO_PROXY: "127.0.0.1,localhost",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout?.on("data", appendLog);
  child.stderr?.on("data", appendLog);
  const instance = {
    appPath,
    label,
    child,
    logs,
    companionPort,
    webPort,
    companionBaseUrl: `http://127.0.0.1:${companionPort}`,
    webBaseUrl: `http://127.0.0.1:${webPort}`,
  };
  try {
    const [health, identity] = await Promise.all([
      waitForHealth(instance.companionBaseUrl, expectedVersion, child, logs),
      waitForWeb(instance.webBaseUrl, child, logs),
    ]);
    return { ...instance, health, identity };
  } catch (error) {
    await stopDesktop(instance);
    throw error;
  }
}

async function stopDesktop(instance) {
  if (!instance) return;
  if (instance.child.exitCode === null) {
    instance.child.kill("SIGTERM");
    await Promise.race([
      new Promise((resolveExit) => instance.child.once("exit", resolveExit)),
      delay(8_000),
    ]);
    if (instance.child.exitCode === null) instance.child.kill("SIGKILL");
  }
  await delay(250);
  await stopOwnedPortProcesses(
    [instance.companionPort, instance.webPort],
    instance.appPath,
  );
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const pids = [
      ...(await pidsListeningOn(instance.companionPort)),
      ...(await pidsListeningOn(instance.webPort)),
    ];
    if (pids.length === 0) break;
    await delay(100);
  }
  assert.deepEqual(await pidsListeningOn(instance.companionPort), []);
  assert.deepEqual(await pidsListeningOn(instance.webPort), []);
  await mkdir(logsRoot, { recursive: true });
  await writeFile(
    join(logsRoot, `${instance.label}.log`),
    instance.logs.join(""),
    "utf8",
  );
}

async function jsonRequest(baseUrl, path, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => null);
  assert.equal(
    response.ok,
    true,
    `${path} failed: ${response.status} ${JSON.stringify(body)}`,
  );
  return body;
}

function runRequest(name, extra = {}) {
  return {
    sessionId: `installed-${name}`,
    projectId: "none",
    workspaceProjectId: "__lazy_default__",
    lazyDefaultWorkspace: {
      moduleId: "chat",
      taskId: `installed-${name}`,
      taskTitle: "Installed macOS acceptance",
    },
    moduleId: "chat",
    binding: { moduleId: "chat", mode: "auto" },
    agentId: "codex",
    agentModel: "default",
    messages: [
      {
        id: `message-${name}`,
        role: "user",
        content: extra.requestedSkillSlug ? "Please use the requested Skill" : "hello",
      },
    ],
    useClientHistory: true,
    ...extra,
  };
}

async function executeRun(baseUrl, name, extra = {}) {
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
  assert(
    ["run.finished", "run.error", "run.cancelled"].some((event) =>
      stream.includes(`event: ${event}`),
    ),
    `${name}: missing terminal event`,
  );
  const record = await jsonRequest(baseUrl, `/v1/runs/${runId}`);
  const events = await jsonRequest(baseUrl, `/v1/runs/${runId}/events`);
  return { runId, record, events: events.items };
}

async function executeCancelledRun(baseUrl) {
  const response = await fetch(`${baseUrl}/v1/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(runRequest("v2-cancel")),
    signal: AbortSignal.timeout(30_000),
  });
  const runId = response.headers.get("x-jlc-run-id");
  assert(runId, "cancel: missing run id");
  const streamPromise = response.text();
  let cancelled = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const cancelResponse = await fetch(`${baseUrl}/v1/runs/${runId}/cancel`, {
      method: "POST",
      signal: AbortSignal.timeout(3_000),
    });
    if (cancelResponse.ok) {
      cancelled = true;
      break;
    }
    if (cancelResponse.status !== 404) {
      throw new Error(`cancel failed: ${cancelResponse.status}`);
    }
    await delay(5);
  }
  assert.equal(cancelled, true, "cancel endpoint never observed the active Run");
  const stream = await streamPromise;
  assert(stream.includes("event: run.cancelled"), "cancel: missing terminal event");
  const record = await jsonRequest(baseUrl, `/v1/runs/${runId}`);
  const events = await jsonRequest(baseUrl, `/v1/runs/${runId}/events`);
  assert.equal(record.status, "cancelled");
  assert.equal(events.items.some((event) => event.type === "run.cancelled"), true);
  return { runId, record, events: events.items };
}

function summarizeRun(result) {
  const started = result.events.find((event) => event.type === "run.started");
  return {
    runId: result.runId,
    status: result.record.status,
    decisionOutcome: result.record.skillDecision?.decisionOutcome ?? null,
    selectionSource: result.record.skillDecision?.selectionSource ?? null,
    primarySkillSlug: result.record.skillDecision?.primarySkillSlug ?? null,
    orchestrationMode: started?.orchestrationMode ?? null,
    injectedSkills: started?.injectedSkills ?? [],
    catalogEntries: started?.catalogSlugs?.length ?? 0,
    skillEvents: result.events
      .filter((event) => event.type.startsWith("skill."))
      .map((event) => event.type),
    terminalEvents: result.events
      .filter((event) => ["run.finished", "run.error", "run.cancelled"].includes(event.type))
      .map((event) => event.type),
  };
}

async function installCandidateFromDmg() {
  await mkdir(mountPoint, { recursive: true });
  await mkdir(installRoot, { recursive: true });
  await runCommand("/usr/bin/hdiutil", [
    "attach",
    "-readonly",
    "-nobrowse",
    "-mountpoint",
    mountPoint,
    candidateDmg,
  ]);
  mounted = true;
  const apps = (await readdir(mountPoint, { withFileTypes: true })).filter(
    (entry) => entry.isDirectory() && entry.name.endsWith(".app"),
  );
  assert.equal(apps.length, 1, `expected one app in DMG, found ${apps.length}`);
  await runCommand("/usr/bin/ditto", [join(mountPoint, apps[0].name), candidateApp]);
  await runCommand("/usr/bin/hdiutil", ["detach", mountPoint]);
  mounted = false;
}

function assertSame(actual, expected, label) {
  assert.deepEqual(actual, expected, `${label} changed`);
}

await mkdir(companionDataDir, { recursive: true });
await mkdir(electronUserDataDir, { recursive: true });
await mkdir(workspaceRoot, { recursive: true });
await mkdir(deliverablesRoot, { recursive: true });
const workspaceSentinel = join(workspaceRoot, "legacy-project", "input.txt");
const deliverableSentinel = join(deliverablesRoot, "legacy-deliverable.md");
await mkdir(dirname(workspaceSentinel), { recursive: true });
await writeFile(workspaceSentinel, "legacy workspace content\n", "utf8");
await writeFile(deliverableSentinel, "# Legacy deliverable\n\nPreserve this file.\n", "utf8");

try {
  assert.equal(await pathExists(baselineApp), true, `baseline app missing: ${baselineApp}`);
  assert.equal(await pathExists(candidateDmg), true, `candidate DMG missing: ${candidateDmg}`);

  const baselineVersion = await appVersion(baselineApp);
  assert.notEqual(
    baselineVersion,
    expectedCandidateVersion,
    "baseline app must be an older installed version",
  );
  await verifySignature(baselineApp);
  const protectedUserDataBefore = await snapshotProtectedUserData();
  const baselineAppBefore = await snapshotTree(baselineApp);
  const fixtureFilesBefore = {
    workspace: await snapshotTree(workspaceRoot),
    deliverables: await snapshotTree(deliverablesRoot),
  };

  activeDesktop = await startDesktop(
    baselineApp,
    "01-baseline-cold-start",
    baselineVersion,
    false,
  );
  const baselineHealth = activeDesktop.health;
  const historyMessages = [
    { id: "history-user", role: "user", content: "preserve this installed message" },
    { id: "history-assistant", role: "assistant", content: "preserved" },
  ];
  await jsonRequest(activeDesktop.companionBaseUrl, "/v1/sessions/installed-history/messages", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectId: "none", messages: historyMessages }),
  });
  const baselineRun = await executeRun(activeDesktop.companionBaseUrl, "baseline-legacy", {
    processSkill: "skill-qa",
    platformNormSkill: "skill-platform-research-norms",
  });
  const baselineRunRecord = structuredClone(baselineRun.record);
  const baselineRunEvents = structuredClone(baselineRun.events);
  await stopDesktop(activeDesktop);
  activeDesktop = null;

  await installCandidateFromDmg();
  assert.equal(await appVersion(candidateApp), expectedCandidateVersion);
  await verifySignature(candidateApp);
  const resources = await candidateResources(candidateApp);
  const dmgSha256 = await sha256File(candidateDmg);

  activeDesktop = await startDesktop(
    candidateApp,
    "02-candidate-v2",
    expectedCandidateVersion,
    true,
  );
  const v2Health = activeDesktop.health;
  const historyAfterUpgrade = await jsonRequest(
    activeDesktop.companionBaseUrl,
    "/v1/sessions/installed-history/messages",
  );
  assertSame(historyAfterUpgrade.messages, historyMessages, "historical messages after upgrade");
  assertSame(
    await jsonRequest(activeDesktop.companionBaseUrl, `/v1/runs/${baselineRun.runId}`),
    baselineRunRecord,
    "baseline RunRecord after upgrade",
  );
  assertSame(
    (await jsonRequest(
      activeDesktop.companionBaseUrl,
      `/v1/runs/${baselineRun.runId}/events`,
    )).items,
    baselineRunEvents,
    "baseline Run events after upgrade",
  );

  const none = await executeRun(activeDesktop.companionBaseUrl, "v2-none");
  const selected = await executeRun(activeDesktop.companionBaseUrl, "v2-selected", {
    requestedSkillSlug: "skill-wr-industry",
  });
  const failed = await executeRun(activeDesktop.companionBaseUrl, "v2-failed", {
    requestedSkillSlug: "skill-qa",
  });
  const cancelled = await executeCancelledRun(activeDesktop.companionBaseUrl);
  assert.equal(none.record.skillDecision?.decisionOutcome, "none");
  assert.deepEqual(summarizeRun(none).skillEvents, []);
  assert.equal(selected.record.skillDecision?.decisionOutcome, "selected");
  assert.deepEqual(summarizeRun(selected).skillEvents, ["skill.selected", "skill.ready"]);
  assert.equal(failed.record.skillDecision?.decisionOutcome, "rejected");
  assert.deepEqual(summarizeRun(failed).skillEvents, ["skill.failed"]);
  const selectedReplay = await jsonRequest(
    activeDesktop.companionBaseUrl,
    `/v1/runs/${selected.runId}/events`,
  );
  assertSame(selectedReplay.items, selected.events, "selected event replay");
  await stopDesktop(activeDesktop);
  activeDesktop = null;

  const fixtureFilesAfterUpgrade = {
    workspace: await snapshotTree(workspaceRoot),
    deliverables: await snapshotTree(deliverablesRoot),
  };
  assertSame(fixtureFilesAfterUpgrade, fixtureFilesBefore, "workspace/deliverable fixtures");

  activeDesktop = await startDesktop(
    candidateApp,
    "03-candidate-legacy",
    expectedCandidateVersion,
    false,
  );
  const legacyHealth = activeDesktop.health;
  const selectedInLegacy = await jsonRequest(
    activeDesktop.companionBaseUrl,
    `/v1/runs/${selected.runId}`,
  );
  assert.equal(selectedInLegacy.skillDecision?.decisionOutcome, "selected");
  const candidateLegacy = await executeRun(
    activeDesktop.companionBaseUrl,
    "candidate-legacy",
    {
      processSkill: "skill-qa",
      platformNormSkill: "skill-platform-research-norms",
    },
  );
  assert.equal(candidateLegacy.record.skillDecision, undefined);
  assert.equal(summarizeRun(candidateLegacy).orchestrationMode, "hybrid-steer");
  await stopDesktop(activeDesktop);
  activeDesktop = null;

  activeDesktop = await startDesktop(
    candidateApp,
    "04-candidate-v2-again",
    expectedCandidateVersion,
    true,
  );
  const v2AgainHealth = activeDesktop.health;
  assert.equal(
    (await jsonRequest(activeDesktop.companionBaseUrl, `/v1/runs/${candidateLegacy.runId}`))
      .skillDecision,
    undefined,
  );
  await stopDesktop(activeDesktop);
  activeDesktop = null;

  activeDesktop = await startDesktop(
    baselineApp,
    "05-baseline-downgrade",
    baselineVersion,
    false,
  );
  const downgradeHealth = activeDesktop.health;
  const downgradeLegacy = await executeRun(
    activeDesktop.companionBaseUrl,
    "downgrade-legacy",
    {
      processSkill: "skill-qa",
      platformNormSkill: "skill-platform-research-norms",
    },
  );
  assert.equal(downgradeLegacy.record.skillDecision, undefined);
  const v2EventsFromBaseline = await jsonRequest(
    activeDesktop.companionBaseUrl,
    `/v1/runs/${selected.runId}/events`,
  );
  assert(Array.isArray(v2EventsFromBaseline.items));
  assertSame(
    (await jsonRequest(
      activeDesktop.companionBaseUrl,
      "/v1/sessions/installed-history/messages",
    )).messages,
    historyMessages,
    "historical messages after downgrade",
  );
  await stopDesktop(activeDesktop);
  activeDesktop = null;

  const protectedUserDataAfter = await snapshotProtectedUserData();
  const baselineAppAfter = await snapshotTree(baselineApp);
  const fixtureFilesAfterDowngrade = {
    workspace: await snapshotTree(workspaceRoot),
    deliverables: await snapshotTree(deliverablesRoot),
  };
  assertSame(protectedUserDataAfter, protectedUserDataBefore, "protected real user data");
  assertSame(baselineAppAfter, baselineAppBefore, "installed baseline app");
  assertSame(fixtureFilesAfterDowngrade, fixtureFilesBefore, "fixture files after downgrade");

  const report = {
    ok: true,
    generatedAt: new Date().toISOString(),
    platform: process.platform,
    architecture: process.arch,
    baseline: {
      appPath: baselineApp,
      version: baselineVersion,
      codeSignatureValid: true,
      appFingerprintPreserved: true,
      health: baselineHealth,
    },
    candidate: {
      dmgPath: candidateDmg,
      dmgSha256,
      stagedInstallPath: candidateApp,
      version: expectedCandidateVersion,
      codeSignatureValid: true,
      resources,
    },
    upgrade: {
      health: v2Health,
      historicalMessagesPreserved: true,
      historicalRunRecordPreserved: true,
      historicalRunEventsPreserved: true,
      workspaceFingerprintPreserved: true,
      deliverableFingerprintPreserved: true,
      none: summarizeRun(none),
      selected: summarizeRun(selected),
      failed: summarizeRun(failed),
      cancelled: summarizeRun(cancelled),
      replayPreserved: true,
    },
    featureFlagRoundTrip: {
      legacyHealth,
      v2AgainHealth,
      legacy: summarizeRun(candidateLegacy),
      v2RunReadableInLegacy: true,
      legacyRunReadableInV2: true,
    },
    downgrade: {
      health: downgradeHealth,
      legacy: summarizeRun(downgradeLegacy),
      unknownV2EventsReadableOrIgnored: true,
      historicalMessagesPreserved: true,
      workspaceFingerprintPreserved: true,
      deliverableFingerprintPreserved: true,
    },
    isolation: {
      realApplicationsModified: false,
      realUserDataPreserved: true,
      protectedRoots: Object.keys(protectedUserDataBefore),
      temporaryRootRemovedOnExit: !args.has("keep-workdir"),
    },
  };
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (activeDesktop) await stopDesktop(activeDesktop);
  if (mounted) {
    await runCommand("/usr/bin/hdiutil", ["detach", mountPoint]).catch(() => {});
  }
  if (!args.has("keep-workdir")) {
    await rm(tempRoot, { recursive: true, force: true });
  } else {
    console.error(`[installed-macos] kept workdir: ${tempRoot}`);
  }
}
