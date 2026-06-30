import { chatExecutionMode, companionConfig } from "@/lib/companion/config";
import { createCompanionProjectEntry } from "@/lib/companion/client";
import { resolveCompanionWorkspaceProjectId } from "@/lib/research-projects-server";
import { NO_PROJECT_ID, SANDBOX_PROJECT_ID } from "@/lib/research-projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const payload =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const type = payload.type === "folder" ? "folder" : payload.type === "file" ? "file" : null;
  const path = typeof payload.path === "string" ? payload.path.trim() : "";
  const projectId =
    typeof payload.projectId === "string" && payload.projectId.trim()
      ? payload.projectId.trim()
      : SANDBOX_PROJECT_ID;
  const content = typeof payload.content === "string" ? payload.content : "";

  if (!type) {
    return Response.json({ error: "invalid_entry_type" }, { status: 400 });
  }
  if (!path) {
    return Response.json({ error: "path_required" }, { status: 400 });
  }
  if (projectId === NO_PROJECT_ID) {
    return Response.json({ error: "workspace_not_ready" }, { status: 409 });
  }
  if (chatExecutionMode() !== "companion" || companionConfig.useMock) {
    return Response.json(
      { error: "workspace_write_unavailable" },
      { status: 409 },
    );
  }

  try {
    const { workspaceProjectId } =
      await resolveCompanionWorkspaceProjectId(projectId);
    const entry = await createCompanionProjectEntry({
      projectId: workspaceProjectId,
      type,
      path,
      content,
    });
    return Response.json({
      ...entry,
      requestedProjectId: projectId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "entry_create_failed";
    const status =
      message.includes("not_found") ? 404
      : message.includes("workspace_not_ready") ? 409
      : 400;
    return Response.json({ error: message }, { status });
  }
}
