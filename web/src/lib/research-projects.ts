import {
  flattenWorkspaceFiles,
  WORKSPACE_ROOT,
  type WorkspaceFileNode,
} from "@/lib/workspace";
import { notifyResearchProjectsUpdated } from "@/lib/research-projects-events";
import { getCachedCompanionLocalBoundProjects } from "@/lib/research-projects-cache";
import type { LocalBoundSource } from "@/lib/companion/types";

export type ResearchProjectKind = "sandbox" | "local_bound";

export type ResearchProject = {
  id: string;
  kind: ResearchProjectKind;
  name: string;
  /** 列表副标题 / 路径摘要 */
  pathSummary: string;
  /** 仅 local_bound */
  bindingSource?: LocalBoundSource;
};

/** @deprecated 迁移用；新任务请用 ensure-default-task-project */
export const SANDBOX_PROJECT_ID = "sandbox-default";

/** UI：未绑定用户课题目录（首条消息前草稿态） */
export const NO_PROJECT_ID = "none";

export const PLATFORM_DEFAULT_GROUP_LABEL = "默认工作区（XIAOCHUANG）";

export const MOCK_RESEARCH_PROJECTS: ResearchProject[] = [
  {
    id: "proj-mengdian",
    kind: "local_bound",
    name: "蒙电十五五",
    pathSummary: "~/Projects/蒙电十五五",
    bindingSource: "user_picked",
  },
  {
    id: "proj-bisheng",
    kind: "local_bound",
    name: "bisheng",
    pathSummary: "~/Projects/bisheng",
    bindingSource: "user_picked",
  },
  {
    id: "proj-llm-platform",
    kind: "local_bound",
    name: "大模型训推平台",
    pathSummary: "~/Projects/大模型训推平台",
    bindingSource: "user_picked",
  },
  {
    id: "proj-hermes",
    kind: "local_bound",
    name: "Hermes-Slate-Desk",
    pathSummary: "~/Projects/Hermes-Slate-Desk",
    bindingSource: "user_picked",
  },
  {
    id: "proj-changan",
    kind: "local_bound",
    name: "长安汽车",
    pathSummary: "~/Projects/长安汽车",
    bindingSource: "user_picked",
  },
];

const SESSION_PROJECT_KEY = (sessionId: string) => `jlc-chat-project-${sessionId}`;
const CUSTOM_PROJECTS_KEY = "jlc-custom-research-projects";
const ENSURED_PROJECTS_KEY = "jlc-ensured-research-projects";

function readEnsuredProjects(): ResearchProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ENSURED_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is ResearchProject =>
        !!p &&
        typeof p === "object" &&
        typeof (p as ResearchProject).id === "string" &&
        (p as ResearchProject).kind === "local_bound" &&
        typeof (p as ResearchProject).name === "string" &&
        typeof (p as ResearchProject).pathSummary === "string",
    );
  } catch {
    return [];
  }
}

export function rememberEnsuredResearchProject(project: ResearchProject): void {
  if (typeof window === "undefined") return;
  const existing = readEnsuredProjects();
  const next = [
    ...existing.filter((p) => p.id !== project.id),
    project,
  ];
  localStorage.setItem(ENSURED_PROJECTS_KEY, JSON.stringify(next));
  notifyResearchProjectsUpdated();
}

function readCustomProjects(): ResearchProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is ResearchProject =>
        !!p &&
        typeof p === "object" &&
        typeof (p as ResearchProject).id === "string" &&
        (p as ResearchProject).kind === "local_bound" &&
        typeof (p as ResearchProject).name === "string" &&
        typeof (p as ResearchProject).pathSummary === "string",
    );
  } catch {
    return [];
  }
}

export function addCustomResearchProject(project: ResearchProject): void {
  if (typeof window === "undefined") return;
  const existing = readCustomProjects();
  const next = [
    ...existing.filter((p) => p.id !== project.id),
    project,
  ];
  localStorage.setItem(CUSTOM_PROJECTS_KEY, JSON.stringify(next));
  notifyResearchProjectsUpdated();
}

export function getResearchProject(id: string): ResearchProject | undefined {
  const fromCompanion =
    typeof window === "undefined"
      ? []
      : getCachedCompanionLocalBoundProjects();
  return (
    readEnsuredProjects().find((p) => p.id === id) ??
    readCustomProjects().find((p) => p.id === id) ??
    fromCompanion.find((p) => p.id === id) ??
    MOCK_RESEARCH_PROJECTS.find((p) => p.id === id)
  );
}

export function getSessionProjectId(sessionId: string): string {
  if (typeof window === "undefined") return NO_PROJECT_ID;
  const raw =
    localStorage.getItem(SESSION_PROJECT_KEY(sessionId)) ?? NO_PROJECT_ID;
  if (raw === SANDBOX_PROJECT_ID) return NO_PROJECT_ID;
  return raw;
}

/** 下拉中可选的本地绑定项目（用户课题；不含平台默认任务目录） */
export function listSelectableLocalProjects(): ResearchProject[] {
  const mock = MOCK_RESEARCH_PROJECTS.filter(
    (p) => p.kind === "local_bound" && p.bindingSource !== "platform_default",
  );
  const custom = readCustomProjects();
  const seen = new Set<string>();
  const merged: ResearchProject[] = [];
  for (const p of [...custom, ...mock]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    merged.push(p);
  }
  return merged;
}

export function isPlatformDefaultProject(projectId: string): boolean {
  if (projectId === NO_PROJECT_ID) return false;
  const p = getResearchProject(projectId);
  return p?.bindingSource === "platform_default";
}

export function isUsingLocalProject(projectId: string): boolean {
  const p = getResearchProject(projectId);
  return p?.kind === "local_bound";
}

/** Hermes / 演示：未选项目时仍回退沙箱（Companion 路径请用 resolveCompanionWorkspaceProjectId） */
export function resolveWorkspaceProjectId(projectId: string): string {
  if (projectId === NO_PROJECT_ID) return SANDBOX_PROJECT_ID;
  return projectId;
}

export function setSessionProjectId(sessionId: string, projectId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_PROJECT_KEY(sessionId), projectId);
  window.dispatchEvent(
    new CustomEvent("jlc-session-project-updated", {
      detail: { sessionId, projectId },
    }),
  );
}

/**
 * @deprecated 使用 `useWorkspace().root` + `flattenWorkspaceFiles`（S2 真树）
 */
export function getMentionableFiles(_projectId: string): WorkspaceFileNode[] {
  return flattenWorkspaceFiles(WORKSPACE_ROOT.children ?? []);
}

export function filterMentionableFiles(
  files: WorkspaceFileNode[],
  query: string,
): WorkspaceFileNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return files.slice(0, 12);
  return files
    .filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.relativePath?.toLowerCase().includes(q) ?? false),
    )
    .slice(0, 12);
}

export function projectWorkLabel(project: ResearchProject): string {
  if (project.bindingSource === "platform_default") {
    return project.name;
  }
  return project.kind === "sandbox" ? "默认工作区" : project.name;
}

export function projectSidebarLabel(projectId: string): string {
  if (projectId === NO_PROJECT_ID) return "默认工作文件夹（XIAOCHUANG）";
  const p = getResearchProject(projectId);
  if (p?.bindingSource === "platform_default") {
    return p.pathSummary;
  }
  return p?.name ?? "未命名工作文件夹";
}
