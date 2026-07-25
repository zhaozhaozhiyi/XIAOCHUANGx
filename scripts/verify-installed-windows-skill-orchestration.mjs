#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
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
import { createConnection, createServer } from "node:net";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const args = new Map(
  process.argv.slice(2).map((item) => {
    const [key, ...value] = item.replace(/^--/, "").split("=");
    return [key, value.join("=")];
  }),
);

assert.equal(
  process.platform,
  "win32",
  "Windows installed acceptance requires a real Windows host",
);

const expectedCandidateVersion = args.get("expected-version") || "0.1.7";
const expectedBaselineVersion = args.get("baseline-version") || "0.1.6-rc.3";
const baselineDir = resolve(
  args.get("baseline-dir") || join(repoRoot, ".runtime", "windows-baseline"),
);
const releaseDir = resolve(
  args.get("release-dir") || join(repoRoot, "apps", "desktop", "release"),
);
const reportPath = resolve(
  args.get("report") ||
    join(
      repoRoot,
      "output",
      "skill-orchestration-0.1.7",
      "installed-windows-report.json",
    ),
);
const tempRoot = await mkdtemp(join(tmpdir(), "jlc-installed-windows-acceptance-"));
const installDir = join(tempRoot, "installed-app");
const companionDataDir = join(tempRoot, "companion-data");
const electronUserDataDir = join(tempRoot, "electron-user-data");
const workspaceRoot = join(tempRoot, "workspaces");
const deliverablesRoot = join(tempRoot, "deliverables");
const logsRoot = join(tempRoot, "logs");
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
    windowsHide: true,
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
  const roaming =
    process.env.APPDATA?.trim() || join(homedir(), "AppData", "Roaming");
  const roots = [
    join(roaming, "小窗"),
    join(homedir(), ".jlcresearch"),
    join(roaming, "@jlc"),
  ];
  const result = {};
  for (const root of roots) result[root] = await snapshotTree(root);
  return result;
}

async function findFile(root, predicate) {
  const matches = [];
  async function visit(path) {
    const entries = await readdir(path, { withFileTypes: true });
    for (const entry of entries) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) {
        await visit(child);
      } else if (entry.isFile() && predicate(entry.name, child)) {
        matches.push(child);
      }
    }
  }
  await visit(root);
  matches.sort((a, b) => a.localeCompare(b, "en"));
  return matches;
}

async function resolveInstaller(root, version) {
  assert.equal(await pathExists(root), true, `installer root missing: ${root}`);
  const expectedName = `小窗-win-${version}.exe`.toLowerCase();
  const exact = await findFile(
    root,
    (name) => name.toLowerCase() === expectedName,
  );
  assert.equal(
    exact.length,
    1,
    `expected one ${expectedName} under ${root}, found ${exact.length}`,
  );
  return exact[0];
}

function desktopExecutable() {
  return join(installDir, "小窗.exe");
}

async function executableVersion(path) {
  const encodedPath = Buffer.from(path, "utf8").toString("base64");
  const script =
    "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;" +
    `$path=[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodedPath}'));` +
    "(Get-Item -LiteralPath $path).VersionInfo.ProductVersion";
  const result = await runCommand("powershell.exe", [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    script,
  ]);
  return result.stdout.trim();
}

function productVersionCore(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  assert(match, `invalid Windows ProductVersion: ${version}`);
  return match.slice(1).map(Number).join(".");
}

async function assertExecutableVersion(path, expectedVersion) {
  const actualVersion = await executableVersion(path);
  assert.equal(
    productVersionCore(actualVersion),
    productVersionCore(expectedVersion),
    `Windows ProductVersion ${actualVersion} does not match ${expectedVersion}`,
  );
  return actualVersion;
}

async function installNsis(installerPath) {
  await mkdir(installDir, { recursive: true });
  await runCommand(installerPath, ["/S", `/D=${installDir}`]);
  const executable = desktopExecutable();
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await pathExists(executable)) return executable;
    await delay(100);
  }
  throw new Error(`NSIS install did not create ${executable}`);
}

async function findUninstaller() {
  if (!(await pathExists(installDir))) return null;
  const uninstallers = await findFile(
    installDir,
    (name) => name.toLowerCase().includes("uninstall") && name.endsWith(".exe"),
  );
  return uninstallers[0] ?? null;
}

async function downgradeNsis(baselineInstaller) {
  let directError = null;
  try {
    await installNsis(baselineInstaller);
    if (
      productVersionCore(await executableVersion(desktopExecutable())) ===
      productVersionCore(expectedBaselineVersion)
    ) {
      return "in-place";
    }
  } catch (error) {
    directError = error;
  }

  const uninstaller = await findUninstaller();
  assert(
    uninstaller,
    `direct downgrade failed and no NSIS uninstaller was found: ${directError ?? "version unchanged"}`,
  );
  await runCommand(uninstaller, ["/S"]);
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && (await pathExists(desktopExecutable()))) {
    await delay(100);
  }
  await installNsis(baselineInstaller);
  await assertExecutableVersion(desktopExecutable(), expectedBaselineVersion);
  return "uninstall-preserve-data-reinstall";
}

async function candidateResources() {
  const resourcesDir = join(installDir, "resources");
  const registry = JSON.parse(
    await readFile(join(resourcesDir, "skills", "skill-registry.generated.json"), "utf8"),
  );
  assert.equal(registry.registryVersion, "0.1.7-v1");
  assert.equal(registry.selectorVersion, "0.1.7-v1");
  assert.equal(registry.skills.length, 48);
  assert.equal(registry.skills.filter((item) => item.status === "active").length, 44);
  assert.equal(registry.skills.filter((item) => item.status === "disabled").length, 4);
  for (const skill of registry.skills.filter((item) => item.status === "active")) {
    assert.equal(
      await pathExists(join(resourcesDir, "skills", skill.slug, "SKILL.md")),
      true,
      `missing installed Skill ${skill.slug}`,
    );
  }
  const requiredPaths = [
    join(resourcesDir, "companion", "companion.cjs"),
    join(resourcesDir, "prompts", "platform", "base-chat.md"),
    join(resourcesDir, "engines", "openscad", "win32", "RUNTIME_MANIFEST.json"),
    join(
      resourcesDir,
      "web-standalone",
      "web",
      "public",
      "openscad-wasm",
      "openscad.wasm",
    ),
  ];
  for (const path of requiredPaths) {
    assert.equal(await pathExists(path), true, `missing installed resource ${path}`);
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

async function isPortListening(port) {
  return new Promise((resolveListening) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolveListening(value);
    };
    socket.setTimeout(500);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function pidsListeningOn(port) {
  assert(Number.isInteger(port) && port > 0 && port <= 65_535);
  const script =
    "$ErrorActionPreference='SilentlyContinue';" +
    `$items=Get-NetTCPConnection -State Listen -LocalPort ${port} ` +
    "-ErrorAction SilentlyContinue;" +
    "if ($items) { $items.OwningProcess | Sort-Object -Unique };" +
    "exit 0";
  const result = await runCommand("powershell.exe", [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    script,
  ]);
  return result.stdout
    .split(/\s+/)
    .map(Number)
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

async function processExecutable(pid) {
  assert(Number.isInteger(pid) && pid > 0);
  const script =
    "$ErrorActionPreference='SilentlyContinue';" +
    `$process=Get-Process -Id ${pid} -ErrorAction SilentlyContinue;` +
    "if ($process) { $process.Path };" +
    "exit 0";
  const result = await runCommand("powershell.exe", [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    script,
  ]);
  return result.stdout.trim();
}

async function stopOwnedPortProcesses(ports) {
  const pids = new Set();
  for (const port of ports) {
    for (const pid of await pidsListeningOn(port)) pids.add(pid);
  }
  const expectedRoot = resolve(installDir).toLowerCase();
  for (const pid of pids) {
    const executable = await processExecutable(pid);
    if (!executable) continue;
    const normalized = resolve(executable).toLowerCase();
    assert(
      normalized === expectedRoot || normalized.startsWith(`${expectedRoot}\\`),
      `refusing to stop unrelated pid ${pid} on an isolated acceptance port: ${executable}`,
    );
    await runCommand("taskkill.exe", ["/PID", String(pid), "/T", "/F"]).catch(
      () => {},
    );
  }
}

async function waitForHealth(baseUrl, expectedVersion, child, logs) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    assert.equal(child.exitCode, null, `desktop exited early\n${logs.join("")}`);
    try {
      const response = await fetch(`${baseUrl}/v1/health`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) {
        const health = await response.json();
        assert.equal(health.ok, true);
        assert.equal(health.version, expectedVersion);
        assert.equal(health.runMode, "simulate");
        return health;
      }
    } catch {
      // Packaged Companion is still starting.
    }
    await delay(100);
  }
  throw new Error(`desktop Companion health timeout\n${logs.join("")}`);
}

async function waitForWeb(baseUrl, child, logs) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    assert.equal(child.exitCode, null, `desktop exited early\n${logs.join("")}`);
    try {
      const response = await fetch(`${baseUrl}/api/app/identity`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) {
        const identity = await response.json();
        assert.equal(identity.appId, "xiaochuang");
        return identity;
      }
    } catch {
      // Embedded Web is still starting.
    }
    await delay(100);
  }
  throw new Error(`desktop embedded Web timeout\n${logs.join("")}`);
}

async function startDesktop(label, expectedVersion, v2Enabled) {
  const companionPort = await freePort();
  const webPort = await freePort();
  assert.equal(await isPortListening(companionPort), false);
  assert.equal(await isPortListening(webPort), false);
  const logs = [];
  let logChars = 0;
  const appendLog = (chunk) => {
    if (logChars >= 200_000) return;
    const text = chunk.toString("utf8");
    logs.push(text);
    logChars += text.length;
  };
  const child = spawn(
    desktopExecutable(),
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
      windowsHide: true,
    },
  );
  child.stdout?.on("data", appendLog);
  child.stderr?.on("data", appendLog);
  const instance = {
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
  if (instance.child.exitCode === null && instance.child.pid) {
    await runCommand("taskkill.exe", [
      "/PID",
      String(instance.child.pid),
      "/T",
      "/F",
    ]).catch(() => {});
    await Promise.race([
      new Promise((resolveExit) => instance.child.once("exit", resolveExit)),
      delay(10_000),
    ]);
  }
  await stopOwnedPortProcesses([instance.companionPort, instance.webPort]);
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (
      !(await isPortListening(instance.companionPort)) &&
      !(await isPortListening(instance.webPort))
    ) {
      break;
    }
    await delay(100);
  }
  assert.equal(await isPortListening(instance.companionPort), false);
  assert.equal(await isPortListening(instance.webPort), false);
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
      taskTitle: "Installed Windows acceptance",
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
      .filter((event) =>
        ["run.finished", "run.error", "run.cancelled"].includes(event.type),
      )
      .map((event) => event.type),
  };
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
  const baselineInstaller = await resolveInstaller(
    baselineDir,
    expectedBaselineVersion,
  );
  const candidateInstaller = await resolveInstaller(
    releaseDir,
    expectedCandidateVersion,
  );
  const protectedUserDataBefore = await snapshotProtectedUserData();
  const fixtureFilesBefore = {
    workspace: await snapshotTree(workspaceRoot),
    deliverables: await snapshotTree(deliverablesRoot),
  };

  await installNsis(baselineInstaller);
  const baselineProductVersion = await assertExecutableVersion(
    desktopExecutable(),
    expectedBaselineVersion,
  );
  activeDesktop = await startDesktop(
    "01-baseline-cold-start",
    expectedBaselineVersion,
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
  assert.equal(summarizeRun(baselineRun).orchestrationMode, "hybrid-steer");
  assert.deepEqual(summarizeRun(baselineRun).skillEvents, []);
  await stopDesktop(activeDesktop);
  activeDesktop = null;

  await installNsis(candidateInstaller);
  const candidateProductVersion = await assertExecutableVersion(
    desktopExecutable(),
    expectedCandidateVersion,
  );
  const resources = await candidateResources();
  activeDesktop = await startDesktop(
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
  assert.deepEqual(summarizeRun(none).injectedSkills, []);
  assert.equal(summarizeRun(none).catalogEntries, 0);
  assert.equal(selected.record.skillDecision?.decisionOutcome, "selected");
  assert.deepEqual(summarizeRun(selected).skillEvents, ["skill.selected", "skill.ready"]);
  assert.equal(summarizeRun(selected).catalogEntries, 0);
  assert.equal(failed.record.skillDecision?.decisionOutcome, "rejected");
  assert.deepEqual(summarizeRun(failed).skillEvents, ["skill.failed"]);
  assert.equal(cancelled.record.skillDecision?.decisionOutcome, "none");
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
    "03-candidate-legacy",
    expectedCandidateVersion,
    false,
  );
  const legacyHealth = activeDesktop.health;
  assert.equal(
    (
      await jsonRequest(activeDesktop.companionBaseUrl, `/v1/runs/${selected.runId}`)
    ).skillDecision?.decisionOutcome,
    "selected",
  );
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
    "04-candidate-v2-again",
    expectedCandidateVersion,
    true,
  );
  const v2AgainHealth = activeDesktop.health;
  assert.equal(
    (
      await jsonRequest(
        activeDesktop.companionBaseUrl,
        `/v1/runs/${candidateLegacy.runId}`,
      )
    ).skillDecision,
    undefined,
  );
  await stopDesktop(activeDesktop);
  activeDesktop = null;

  const downgradeMethod = await downgradeNsis(baselineInstaller);
  const downgradeProductVersion = await assertExecutableVersion(
    desktopExecutable(),
    expectedBaselineVersion,
  );
  activeDesktop = await startDesktop(
    "05-baseline-downgrade",
    expectedBaselineVersion,
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
  assert.equal(summarizeRun(downgradeLegacy).orchestrationMode, "hybrid-steer");
  assert.deepEqual(summarizeRun(downgradeLegacy).skillEvents, []);
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
  const fixtureFilesAfterDowngrade = {
    workspace: await snapshotTree(workspaceRoot),
    deliverables: await snapshotTree(deliverablesRoot),
  };
  assertSame(protectedUserDataAfter, protectedUserDataBefore, "protected real user data");
  assertSame(fixtureFilesAfterDowngrade, fixtureFilesBefore, "fixture files after downgrade");

  const report = {
    ok: true,
    generatedAt: new Date().toISOString(),
    platform: process.platform,
    architecture: process.arch,
    runnerImage: process.env.ImageOS ?? null,
    baseline: {
      installerPath: baselineInstaller,
      installerSha256: await sha256File(baselineInstaller),
      version: expectedBaselineVersion,
      productVersion: baselineProductVersion,
      health: baselineHealth,
    },
    candidate: {
      installerPath: candidateInstaller,
      installerSha256: await sha256File(candidateInstaller),
      version: expectedCandidateVersion,
      productVersion: candidateProductVersion,
      resources,
    },
    upgrade: {
      method: "nsis-in-place",
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
      method: downgradeMethod,
      productVersion: downgradeProductVersion,
      health: downgradeHealth,
      legacy: summarizeRun(downgradeLegacy),
      unknownV2EventsReadableOrIgnored: true,
      historicalMessagesPreserved: true,
      workspaceFingerprintPreserved: true,
      deliverableFingerprintPreserved: true,
    },
    isolation: {
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
  if (!args.has("keep-workdir")) {
    await rm(tempRoot, { recursive: true, force: true });
  } else {
    console.error(`[installed-windows] kept workdir: ${tempRoot}`);
  }
}
