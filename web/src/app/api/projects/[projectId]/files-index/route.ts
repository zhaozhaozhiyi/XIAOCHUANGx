import { chatExecutionMode, companionConfig } from "@/lib/companion/config";
import { fetchCompanionProjectFilesIndex } from "@/lib/companion/client";
import { resolveCompanionWorkspaceProjectId } from "@/lib/research-projects-server";
import { flattenWorkspaceFiles, WORKSPACE_ROOT } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (chatExecutionMode() !== "companion" || companionConfig.useMock) {
    const paths = flattenWorkspaceFiles(WORKSPACE_ROOT.children ?? [])
      .map((f) => f.relativePath ?? f.name)
      .filter(Boolean);
    const filtered = q
      ? paths.filter(
          (p) =>
            p.toLowerCase().includes(q.toLowerCase()) ||
            p.split("/").pop()?.toLowerCase().includes(q.toLowerCase()),
        )
      : paths;
    return Response.json({ projectId, files: filtered, mode: "mock" });
  }

  try {
    const workspaceProjectId = await resolveCompanionWorkspaceProjectId(
      projectId,
    );
    const { files } = await fetchCompanionProjectFilesIndex(
      workspaceProjectId,
      q || undefined,
    );
    return Response.json({
      projectId: workspaceProjectId,
      files,
      mode: "live",
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : "files_index_failed";
    return Response.json({ error: code, projectId }, { status: 500 });
  }
}
