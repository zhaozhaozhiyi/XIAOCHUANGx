import { chatExecutionMode, companionConfig } from "@/lib/companion/config";
import { fetchCompanionProjects } from "@/lib/companion/client";
import { MOCK_RESEARCH_PROJECTS } from "@/lib/research-projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (chatExecutionMode() !== "companion") {
    return Response.json({
      execution: chatExecutionMode(),
      projects: MOCK_RESEARCH_PROJECTS.map((p) => ({
        projectId: p.id,
        name: p.name,
        workspaceKind: p.kind,
        pathSummary: p.pathSummary,
      })),
    });
  }

  if (companionConfig.useMock) {
    return Response.json({
      execution: "companion",
      mode: "mock",
      projects: MOCK_RESEARCH_PROJECTS.map((p) => ({
        projectId: p.id,
        name: p.name,
        workspaceKind: p.kind,
        pathSummary: p.pathSummary,
      })),
    });
  }

  try {
    const { projects } = await fetchCompanionProjects();
    return Response.json({
      execution: "companion",
      mode: "live",
      projects,
    });
  } catch (err) {
    return Response.json(
      {
        execution: "companion",
        mode: "live",
        ok: false,
        error: err instanceof Error ? err.message : "unreachable",
        projects: [],
      },
      { status: 502 },
    );
  }
}

/** @deprecated 本地目录请使用 POST /api/projects/import-folder */
export async function POST() {
  return Response.json(
    {
      error: "use_import_folder",
      message: "请使用 POST /api/projects/import-folder 绑定本地文件夹",
    },
    { status: 400 },
  );
}
