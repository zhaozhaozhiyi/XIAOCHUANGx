import { homedir } from "node:os";
import { join } from "node:path";
import {
  ensureCompanionDefaultTaskProject,
  ensureCompanionProject,
} from "@/lib/companion/client";
import type { ModuleId } from "@/lib/module-registry";
import {
  getResearchProject,
  NO_PROJECT_ID,
  type ResearchProject,
} from "@/lib/research-projects";

/** 将 UI 中的 `~/Projects/foo` 展开为本机绝对路径 */
export function expandPathSummary(pathSummary: string): string {
  const trimmed = pathSummary.trim();
  if (trimmed.startsWith("~/")) {
    return join(homedir(), trimmed.slice(2));
  }
  return trimmed;
}

export type ResolveCompanionWorkspaceResult = {
  workspaceProjectId: string;
  /** 由 ensure-default-task-project 新解析出的 projectId */
  ensuredProject?: ResearchProject;
  lazyDefaultWorkspace?: {
    moduleId: ModuleId;
    taskId?: string;
    taskTitle?: string;
  };
};

/**
 * 将 Web 研究项目 ID 解析为 Companion 可扫描的 workspaceProjectId。
 * 未选课题时调用 ensure-default-task-project（§5.3.2.1a）。
 */
export async function resolveCompanionWorkspaceProjectId(
  uiProjectId: string,
  options?: {
    moduleId?: ModuleId;
    taskId?: string;
    taskTitle?: string;
    requiresImmediateWorkspace?: boolean;
  },
): Promise<ResolveCompanionWorkspaceResult> {
  if (uiProjectId !== NO_PROJECT_ID) {
    const mock = getResearchProject(uiProjectId);
    if (mock?.kind === "local_bound") {
      await ensureCompanionProject({
        projectId: mock.id,
        workspaceKind: "local_bound",
        name: mock.name,
        baseDir: expandPathSummary(mock.pathSummary),
        bindingSource: mock.bindingSource ?? "user_picked",
      });
    }
    return { workspaceProjectId: uiProjectId };
  }

  if (!options?.moduleId) {
    throw new Error("module_id_required_for_default_workspace");
  }

  if (
    (options.moduleId === "3d" || options.moduleId === "video") &&
    !options.requiresImmediateWorkspace
  ) {
    return {
      workspaceProjectId: "__lazy_default__",
      lazyDefaultWorkspace: {
        moduleId: options.moduleId,
        taskId: options.taskId,
        taskTitle: options.taskTitle,
      },
    };
  }

  const summary = await ensureCompanionDefaultTaskProject({
    moduleId: options.moduleId,
    taskId: options.taskId,
    taskTitle: options.taskTitle,
  });

  const ensuredProject: ResearchProject = {
    id: summary.projectId,
    kind: "local_bound",
    name: summary.name,
    pathSummary: summary.pathSummary,
    bindingSource: summary.bindingSource ?? "platform_default",
  };

  return {
    workspaceProjectId: summary.projectId,
    ensuredProject,
  };
}

export function isNoProject(uiProjectId: string): boolean {
  return uiProjectId === NO_PROJECT_ID;
}

export function companionSummaryToResearchProject(
  summary: {
    projectId: string;
    name: string;
    workspaceKind: string;
    pathSummary: string;
    bindingSource?: "user_picked" | "platform_default";
  },
): ResearchProject | null {
  if (summary.workspaceKind !== "local_bound") return null;
  return {
    id: summary.projectId,
    kind: "local_bound",
    name: summary.name,
    pathSummary: summary.pathSummary,
    bindingSource: summary.bindingSource ?? "user_picked",
  };
}
