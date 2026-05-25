import {
  flattenWorkspaceFiles,
  WORKSPACE_ROOT,
  type WorkspaceFileNode,
} from "@/lib/workspace";
import { notifyResearchProjectsUpdated } from "@/lib/research-projects-events";
import { getCachedCompanionLocalBoundProjects } from "@/lib/research-projects-cache";

export type ResearchProjectKind = "sandbox" | "local_bound";

export type ResearchProject = {
  id: string;
  kind: ResearchProjectKind;
  name: string;
  /** 列表副标题 / 路径摘要 */
  pathSummary: string;
};

export const SANDBOX_PROJECT_ID = "sandbox-default";

/** UI：未绑定本地项目（Codex「不使用项目」；执行层仍落沙箱） */
export const NO_PROJECT_ID = "none";

export const MOCK_RESEARCH_PROJECTS: ResearchProject[] = [
  {
    id: SANDBOX_PROJECT_ID,
    kind: "sandbox",
    name: "临时工作区",
    pathSummary: "Companion 托管 · 当前会话沙箱",
  },
  {
    id: "proj-mengdian",
    kind: "local_bound",
    name: "蒙电十五五",
    pathSummary: "~/Projects/蒙电十五五",
  },
  {
    id: "proj-bisheng",
    kind: "local_bound",
    name: "bisheng",
    pathSummary: "~/Projects/bisheng",
  },
  {
    id: "proj-llm-platform",
    kind: "local_bound",
    name: "大模型训推平台",
    pathSummary: "~/Projects/大模型训推平台",
  },
  {
    id: "proj-hermes",
    kind: "local_bound",
    name: "Hermes-Slate-Desk",
    pathSummary: "~/Projects/Hermes-Slate-Desk",
  },
  {
    id: "proj-changan",
    kind: "local_bound",
    name: "长安汽车",
    pathSummary: "~/Projects/长安汽车",
  },
];

const SESSION_PROJECT_KEY = (sessionId: string) => `jlc-chat-project-${sessionId}`;
const CUSTOM_PROJECTS_KEY = "jlc-custom-research-projects";

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

/** 下拉中可选的本地绑定项目（不含沙箱；含用户添加项） */
export function listSelectableLocalProjects(): ResearchProject[] {
  const mock = MOCK_RESEARCH_PROJECTS.filter((p) => p.kind === "local_bound");
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

export function isUsingLocalProject(projectId: string): boolean {
  const p = getResearchProject(projectId);
  return p?.kind === "local_bound";
}

/** 发送 / 工作区：未选项目时回退沙箱 */
export function resolveWorkspaceProjectId(projectId: string): string {
  if (projectId === NO_PROJECT_ID) return SANDBOX_PROJECT_ID;
  return projectId;
}

export function setSessionProjectId(sessionId: string, projectId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_PROJECT_KEY(sessionId), projectId);
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
  return project.kind === "sandbox" ? "临时工作区" : project.name;
}
