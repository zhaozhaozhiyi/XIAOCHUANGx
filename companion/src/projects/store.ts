import {
  mkdir,
  readFile,
  writeFile,
  access,
  constants,
  realpath,
  open,
} from "node:fs/promises";
import {
  join,
  resolve,
  normalize,
  relative,
  isAbsolute,
  basename,
  sep,
  parse,
} from "node:path";
import { randomUUID } from "node:crypto";
import { homedir, platform } from "node:os";
import type {
  CompanionProjectSummary,
  WorkspaceKind,
} from "../types.js";
import { config, projectsDir } from "../config.js";

type ProjectRecord = CompanionProjectSummary & {
  createdAt: string;
};

type ProjectsDb = {
  projects: ProjectRecord[];
};

const DB_FILE = () => join(config.dataDir, "projects.json");

const SANDBOX_DEFAULT_ID = "sandbox-default";

async function ensureDataDir(): Promise<void> {
  await mkdir(config.dataDir, { recursive: true });
  await mkdir(projectsDir(), { recursive: true });
}

async function loadDb(): Promise<ProjectsDb> {
  await ensureDataDir();
  try {
    const raw = await readFile(DB_FILE(), "utf8");
    const parsed = JSON.parse(raw) as ProjectsDb;
    if (!Array.isArray(parsed.projects)) return { projects: [] };
    return parsed;
  } catch {
    return { projects: [] };
  }
}

async function saveDb(db: ProjectsDb): Promise<void> {
  await writeFile(DB_FILE(), JSON.stringify(db, null, 2), "utf8");
}

function toSummary(p: ProjectRecord): CompanionProjectSummary {
  const { createdAt: _c, ...rest } = p;
  return rest;
}

export async function ensureDefaultSandbox(): Promise<CompanionProjectSummary> {
  const db = await loadDb();
  let sandbox = db.projects.find((p) => p.projectId === SANDBOX_DEFAULT_ID);
  if (!sandbox) {
    const root = join(projectsDir(), SANDBOX_DEFAULT_ID);
    await mkdir(root, { recursive: true });
    sandbox = {
      projectId: SANDBOX_DEFAULT_ID,
      name: "临时工作区",
      workspaceKind: "sandbox",
      pathSummary: `${root}`,
      createdAt: new Date().toISOString(),
    };
    db.projects.push(sandbox);
    await saveDb(db);
  } else {
    await mkdir(resolveProjectRoot(sandbox), { recursive: true });
  }
  return toSummary(sandbox);
}

export async function listProjects(): Promise<CompanionProjectSummary[]> {
  await ensureDefaultSandbox();
  const db = await loadDb();
  return db.projects.map(toSummary);
}

export async function getProject(
  projectId: string,
): Promise<CompanionProjectSummary | null> {
  await ensureDefaultSandbox();
  const db = await loadDb();
  const p = db.projects.find((x) => x.projectId === projectId);
  return p ? toSummary(p) : null;
}

function expandUserPath(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("~/")) {
    return join(homedir(), trimmed.slice(2));
  }
  if (trimmed === "~") {
    return homedir();
  }
  return trimmed;
}

function formatPathSummary(absPath: string): string {
  const home = homedir();
  const resolved = resolve(absPath);
  const rel = relative(home, resolved);
  if (!rel.startsWith("..") && !isAbsolute(rel)) {
    const suffix = rel ? `/${rel}` : "";
    return `~${suffix}`.replace(/\/+$/, "") || "~";
  }
  return resolved;
}

function validateLocalBaseDir(baseDir: string): string {
  const resolved = resolve(baseDir);
  if (parse(resolved).root === resolved) {
    throw new Error("baseDir_forbidden");
  }
  const home = homedir();
  const rel = relative(home, resolved);
  if (platform() !== "win32" && (rel.startsWith("..") || isAbsolute(rel))) {
    throw new Error("baseDir_must_be_under_home");
  }
  const normalizedResolved =
    platform() === "win32" ? resolved.toLowerCase() : resolved;
  const forbidden =
    platform() === "win32"
      ? [
          resolve(process.env.SystemRoot ?? "C:\\Windows"),
          resolve(process.env.ProgramFiles ?? "C:\\Program Files"),
          resolve(
            process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
          ),
          resolve(process.env.ProgramData ?? "C:\\ProgramData"),
        ]
      : ["/etc", "/usr", "/bin", "/sbin", "/var", "/System"];
  if (
    forbidden.some((f) => {
      const normalizedForbidden =
        platform() === "win32" ? resolve(f).toLowerCase() : resolve(f);
      return (
        normalizedResolved === normalizedForbidden ||
        normalizedResolved.startsWith(`${normalizedForbidden}${sep}`)
      );
    })
  ) {
    throw new Error("baseDir_forbidden");
  }
  const dataResolved =
    platform() === "win32"
      ? resolve(config.dataDir).toLowerCase()
      : resolve(config.dataDir);
  if (
    normalizedResolved === dataResolved ||
    normalizedResolved.startsWith(`${dataResolved}${sep}`)
  ) {
    throw new Error("baseDir_in_data_dir");
  }
  return resolved;
}

/**
 * 文件夹导入：绑定 local_bound，不复制；同一路径幂等返回已有 projectId。
 */
export async function importFolder(input: {
  name?: string;
  baseDir: string;
}): Promise<CompanionProjectSummary> {
  await ensureDataDir();
  if (!input.baseDir?.trim()) throw new Error("baseDir_required");

  const expanded = expandUserPath(input.baseDir);
  let resolved: string;
  try {
    resolved = await realpath(expanded);
  } catch {
    throw new Error("baseDir_not_accessible");
  }

  validateLocalBaseDir(resolved);
  await access(resolved, constants.R_OK).catch(() => {
    throw new Error("baseDir_not_accessible");
  });

  const db = await loadDb();
  const existing = db.projects.find(
    (p) => p.workspaceKind === "local_bound" && p.baseDir === resolved,
  );
  if (existing) {
    const nextName = input.name?.trim();
    if (nextName && nextName !== existing.name) {
      existing.name = nextName;
      existing.pathSummary = formatPathSummary(resolved);
      await saveDb(db);
    }
    return toSummary(existing);
  }

  const projectId = `proj-${randomUUID().slice(0, 8)}`;
  const name =
    input.name?.trim() || basename(resolved) || "未命名项目";
  const pathSummary = formatPathSummary(resolved);

  const record: ProjectRecord = {
    projectId,
    name,
    workspaceKind: "local_bound",
    pathSummary,
    baseDir: resolved,
    createdAt: new Date().toISOString(),
  };
  db.projects.push(record);
  await saveDb(db);
  return toSummary(record);
}

/** 按固定 projectId 注册/更新（Web 研究项目列表与 Companion 对齐） */
export async function ensureProject(input: {
  projectId: string;
  workspaceKind: WorkspaceKind;
  name: string;
  baseDir?: string;
}): Promise<CompanionProjectSummary> {
  await ensureDataDir();
  if (input.workspaceKind === "sandbox") {
    return ensureDefaultSandbox();
  }

  const existing = await getProject(input.projectId);
  if (input.workspaceKind === "local_bound") {
    if (!input.baseDir?.trim()) throw new Error("baseDir_required");
    const baseDir = validateLocalBaseDir(expandUserPath(input.baseDir));
    await access(baseDir, constants.R_OK).catch(() => {
      throw new Error("baseDir_not_accessible");
    });

    if (existing) {
      if (existing.workspaceKind !== "local_bound") {
        throw new Error("project_kind_mismatch");
      }
      if (existing.baseDir !== baseDir) {
        const db = await loadDb();
        const idx = db.projects.findIndex(
          (p) => p.projectId === input.projectId,
        );
        if (idx >= 0) {
          db.projects[idx] = {
            ...db.projects[idx]!,
            name: input.name.trim() || existing.name,
            baseDir,
            pathSummary: formatPathSummary(baseDir),
          };
          await saveDb(db);
          return toSummary(db.projects[idx]!);
        }
      }
      return existing;
    }

    const db = await loadDb();
    const record: ProjectRecord = {
      projectId: input.projectId,
      name: input.name.trim() || "未命名项目",
      workspaceKind: "local_bound",
      pathSummary: formatPathSummary(baseDir),
      baseDir,
      createdAt: new Date().toISOString(),
    };
    db.projects.push(record);
    await saveDb(db);
    return toSummary(record);
  }

  if (existing) return existing;
  throw new Error("unsupported_ensure_kind");
}

export async function createProject(input: {
  workspaceKind: WorkspaceKind;
  name: string;
  baseDir?: string;
}): Promise<CompanionProjectSummary> {
  await ensureDataDir();
  const db = await loadDb();
  const projectId =
    input.workspaceKind === "sandbox"
      ? `sandbox-${randomUUID().slice(0, 8)}`
      : `proj-${randomUUID().slice(0, 8)}`;

  let pathSummary: string;
  let baseDir: string | undefined;

  if (input.workspaceKind === "local_bound") {
    if (!input.baseDir?.trim()) throw new Error("baseDir_required");
    baseDir = validateLocalBaseDir(expandUserPath(input.baseDir));
    await access(baseDir, constants.R_OK).catch(() => {
      throw new Error("baseDir_not_accessible");
    });
    pathSummary = formatPathSummary(baseDir);
  } else {
    const root = join(projectsDir(), projectId);
    await mkdir(root, { recursive: true });
    pathSummary = root;
  }

  const record: ProjectRecord = {
    projectId,
    name: input.name.trim() || "未命名项目",
    workspaceKind: input.workspaceKind,
    pathSummary,
    baseDir,
    createdAt: new Date().toISOString(),
  };
  db.projects.push(record);
  await saveDb(db);
  return toSummary(record);
}

export function resolveProjectRootFromId(
  project: CompanionProjectSummary | null,
  workspaceProjectId: string,
): string {
  if (project) return resolveProjectRoot(project);
  if (workspaceProjectId === SANDBOX_DEFAULT_ID) {
    return join(projectsDir(), SANDBOX_DEFAULT_ID);
  }
  throw new Error("project_not_found");
}

function resolveProjectRoot(p: CompanionProjectSummary): string {
  if (p.workspaceKind === "local_bound" && p.baseDir) {
    return resolve(p.baseDir);
  }
  return join(projectsDir(), p.projectId);
}

function sanitizeFilename(value: string, fallback = "attachment"): string {
  const safe = basename(value)
    .replace(/[^\w.\-\u4e00-\u9fa5]/g, "_")
    .slice(0, 160);
  return safe && safe.replace(/\./g, "") ? safe : fallback;
}

async function uniqueRootFilePath(
  projectRoot: string,
  safeName: string,
  bytes: Buffer,
): Promise<{ relativePath: string }> {
  const parsed = parse(safeName);
  for (let idx = 0; idx < 1000; idx++) {
    const relativePath =
      idx === 0 ? safeName : `${parsed.name}-${idx}${parsed.ext}`;
    const fullPath = safeRelativePath(projectRoot, relativePath);
    try {
      const handle = await open(fullPath, "wx");
      try {
        await handle.writeFile(bytes);
      } finally {
        await handle.close();
      }
      return { relativePath };
    } catch (e) {
      if (
        e instanceof Error &&
        "code" in e &&
        (e as NodeJS.ErrnoException).code === "EEXIST"
      ) {
        continue;
      }
      throw e;
    }
  }
  throw new Error("too_many_duplicate_uploads");
}

export async function resolveWorkspaceRoot(
  workspaceProjectId: string,
): Promise<string> {
  const project = await getProject(workspaceProjectId);
  if (project) {
    const root = resolveProjectRoot(project);
    await mkdir(root, { recursive: true });
    return root;
  }
  if (workspaceProjectId === SANDBOX_DEFAULT_ID) {
    const s = await ensureDefaultSandbox();
    return resolveProjectRoot(s);
  }
  throw new Error("project_not_found");
}

export async function writeProjectUpload(input: {
  workspaceProjectId: string;
  filename: string;
  bytes: Buffer;
}): Promise<{ path: string; size: number }> {
  const root = await resolveWorkspaceRoot(input.workspaceProjectId);
  const safeName = sanitizeFilename(input.filename);
  const { relativePath } = await uniqueRootFilePath(root, safeName, input.bytes);
  return { path: relativePath, size: input.bytes.length };
}

export function safeRelativePath(projectRoot: string, relPath: string): string {
  const normalized = normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const full = resolve(projectRoot, normalized);
  const rel = relative(projectRoot, full);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("path_escape");
  }
  return full;
}
