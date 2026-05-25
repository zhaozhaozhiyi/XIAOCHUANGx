import { homedir } from "node:os";
import { join } from "node:path";
import { ensureCompanionProject } from "@/lib/companion/client";
import {
  getResearchProject,
  NO_PROJECT_ID,
  resolveWorkspaceProjectId,
  SANDBOX_PROJECT_ID,
} from "@/lib/research-projects";

/** 将 UI 中的 `~/Projects/foo` 展开为本机绝对路径 */
export function expandPathSummary(pathSummary: string): string {
  const trimmed = pathSummary.trim();
  if (trimmed.startsWith("~/")) {
    return join(homedir(), trimmed.slice(2));
  }
  return trimmed;
}

/**
 * 将 Web 研究项目 ID 解析为 Companion 可扫描的 workspaceProjectId。
 * 本地绑定项目在 Companion 中按需 ensure（固定 projectId + baseDir）。
 */
export async function resolveCompanionWorkspaceProjectId(
  uiProjectId: string,
): Promise<string> {
  const workspaceProjectId = resolveWorkspaceProjectId(uiProjectId);
  if (workspaceProjectId === SANDBOX_PROJECT_ID) {
    return SANDBOX_PROJECT_ID;
  }

  const mock = getResearchProject(uiProjectId);
  if (!mock || mock.kind !== "local_bound") {
    return workspaceProjectId;
  }

  await ensureCompanionProject({
    projectId: mock.id,
    workspaceKind: "local_bound",
    name: mock.name,
    baseDir: expandPathSummary(mock.pathSummary),
  });

  return mock.id;
}

export function isNoProject(uiProjectId: string): boolean {
  return uiProjectId === NO_PROJECT_ID;
}
