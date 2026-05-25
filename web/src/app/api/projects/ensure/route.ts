import { chatExecutionMode, companionConfig } from "@/lib/companion/config";
import { resolveCompanionWorkspaceProjectId } from "@/lib/research-projects-server";
import { getResearchProject } from "@/lib/research-projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (chatExecutionMode() !== "companion" || companionConfig.useMock) {
    return Response.json({ mode: "mock", ok: true });
  }

  let uiProjectId: string | undefined;
  try {
    const body = (await req.json()) as { projectId?: string };
    uiProjectId = body.projectId?.trim();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!uiProjectId) {
    return Response.json({ error: "project_id_required" }, { status: 400 });
  }

  try {
    const workspaceProjectId =
      await resolveCompanionWorkspaceProjectId(uiProjectId);
    const mock = getResearchProject(uiProjectId);
    return Response.json({
      ok: true,
      uiProjectId,
      workspaceProjectId,
      name: mock?.name ?? workspaceProjectId,
      pathSummary: mock?.pathSummary,
    });
  } catch (err) {
    return Response.json(
      {
        error: err instanceof Error ? err.message : "ensure_failed",
      },
      { status: 400 },
    );
  }
}
