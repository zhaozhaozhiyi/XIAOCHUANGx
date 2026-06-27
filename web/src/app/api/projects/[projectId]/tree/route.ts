import { chatExecutionMode, companionConfig } from "@/lib/companion/config";
import {
  fetchCompanionProjectTree,
  fetchCompanionProjectTreeChildren,
} from "@/lib/companion/client";
import {
  buildWorkspaceRoot,
  mapCompanionTreeNodes,
} from "@/lib/workspace/adapter";
import { resolveCompanionWorkspaceProjectId } from "@/lib/research-projects-server";
import {
  getResearchProject,
  NO_PROJECT_ID,
  SANDBOX_PROJECT_ID,
} from "@/lib/research-projects";
import { findWorkspaceFile, WORKSPACE_ROOT } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

function projectLabel(projectId: string): string {
  const mock = getResearchProject(projectId);
  if (mock) return mock.name;
  if (projectId === SANDBOX_PROJECT_ID) return "默认工作区";
  return projectId;
}

export async function GET(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const relPath = new URL(request.url).searchParams.get("path")?.trim() ?? "";

  // 草稿态尚未创建任务目录：返回空树而不是抛 module_id_required。
  if (projectId === NO_PROJECT_ID) {
    if (relPath) {
      return Response.json({
        projectId,
        mode: "draft",
        path: relPath,
        nodes: [],
      });
    }
    return Response.json({
      projectId,
      mode: "draft",
      root: null,
      tree: [],
      rootNode: {
        id: "root",
        name: "默认工作区（XIAOCHUANG）",
        type: "folder",
        children: [],
      },
      label: "默认工作区（XIAOCHUANG）",
    });
  }

  if (chatExecutionMode() !== "companion" || companionConfig.useMock) {
    if (relPath) {
      const folder = findWorkspaceFile(
        WORKSPACE_ROOT.children ?? [],
        relPath,
      );
      return Response.json({
        projectId,
        mode: "mock",
        path: relPath,
        nodes: folder?.children ?? [],
      });
    }
    return Response.json({
      projectId,
      mode: "mock",
      root: null,
      tree: mapCompanionTreeNodes(
        (WORKSPACE_ROOT.children ?? []).map((n) => ({
          id: n.id,
          name: n.name,
          type: n.type,
          relativePath: n.relativePath,
          children: n.children?.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            relativePath: c.relativePath,
            children: c.children,
          })),
        })),
      ),
      rootNode: WORKSPACE_ROOT,
      label: projectLabel(projectId),
    });
  }

  try {
    const { workspaceProjectId } =
      await resolveCompanionWorkspaceProjectId(projectId);
    if (relPath) {
      const { nodes } = await fetchCompanionProjectTreeChildren(
        workspaceProjectId,
        relPath,
      );
      return Response.json({
        projectId: workspaceProjectId,
        mode: "live",
        path: relPath,
        nodes: mapCompanionTreeNodes(nodes),
      });
    }
    const payload = await fetchCompanionProjectTree(workspaceProjectId);
    const label = projectLabel(projectId);
    return Response.json({
      projectId: payload.projectId,
      mode: "live",
      root: payload.root,
      tree: payload.tree,
      rootNode: buildWorkspaceRoot(payload.tree, label),
      label,
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : "tree_failed";
    const status =
      code === "baseDir_not_accessible" || code === "baseDir_required"
        ? 400
        : 404;
    return Response.json(
      {
        error: code,
        message:
          code === "baseDir_not_accessible"
            ? "本地项目目录不存在或不可读，请检查路径是否在本机存在"
            : undefined,
        projectId,
      },
      { status },
    );
  }
}
