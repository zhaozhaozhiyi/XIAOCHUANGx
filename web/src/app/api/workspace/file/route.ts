import { readFile } from "node:fs/promises";
import { inferMimeFromPath, isBinaryWorkspacePath } from "@/lib/workspace-binary";
import { chatExecutionMode, companionConfig } from "@/lib/companion/config";
import {
  fetchCompanionProjectFile,
  writeCompanionProjectFile,
} from "@/lib/companion/client";
import { resolveCompanionWorkspaceProjectId } from "@/lib/research-projects-server";
import { NO_PROJECT_ID, SANDBOX_PROJECT_ID } from "@/lib/research-projects";
import { resolveLegacySafePath } from "@/lib/legacy-workspace-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rel = url.searchParams.get("path");
  const projectId =
    url.searchParams.get("projectId")?.trim() || SANDBOX_PROJECT_ID;

  if (!rel?.trim()) {
    return Response.json({ error: "path is required" }, { status: 400 });
  }

  if (projectId === NO_PROJECT_ID) {
    return Response.json({ error: "workspace_not_ready" }, { status: 409 });
  }

  if (
    chatExecutionMode() === "companion" &&
    !companionConfig.useMock
  ) {
    try {
      const { workspaceProjectId } =
        await resolveCompanionWorkspaceProjectId(projectId);
      const file = await fetchCompanionProjectFile(
        workspaceProjectId,
        rel.trim(),
      );
      return Response.json({
        path: rel,
        projectId,
        content: file.content,
        mime: file.mime,
        encoding: file.encoding ?? "utf8",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "read failed";
      const status = message.includes("not_found") ? 404 : 400;
      return Response.json({ error: message }, { status });
    }
  }

  const full = resolveLegacySafePath(rel.trim());
  if (!full) {
    return Response.json({ error: "invalid path" }, { status: 400 });
  }

  try {
    if (isBinaryWorkspacePath(rel.trim())) {
      const buf = await readFile(full);
      return Response.json({
        path: rel,
        projectId,
        content: buf.toString("base64"),
        mime: inferMimeFromPath(rel.trim()),
        encoding: "base64",
        mode: "legacy",
      });
    }
    const content = await readFile(full, "utf8");
    return Response.json({
      path: rel,
      projectId,
      content,
      encoding: "utf8",
      mode: "legacy",
    });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return Response.json({ error: "file not found" }, { status: 404 });
    }
    return Response.json({ error: "read failed" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const payload = body && typeof body === "object"
    ? (body as Record<string, unknown>)
    : {};
  const rel = typeof payload.path === "string" ? payload.path.trim() : "";
  const projectId =
    typeof payload.projectId === "string" && payload.projectId.trim()
      ? payload.projectId.trim()
      : SANDBOX_PROJECT_ID;
  const content = typeof payload.content === "string" ? payload.content : null;
  const encoding = payload.encoding === "base64" ? "base64" : "utf8";

  if (!rel) {
    return Response.json({ error: "path is required" }, { status: 400 });
  }
  if (content == null) {
    return Response.json({ error: "content is required" }, { status: 400 });
  }
  if (projectId === NO_PROJECT_ID) {
    return Response.json({ error: "workspace_not_ready" }, { status: 409 });
  }
  if (
    chatExecutionMode() !== "companion" ||
    companionConfig.useMock
  ) {
    return Response.json({ error: "workspace_write_unavailable" }, { status: 409 });
  }

  try {
    const { workspaceProjectId } =
      await resolveCompanionWorkspaceProjectId(projectId);
    const written = await writeCompanionProjectFile({
      projectId: workspaceProjectId,
      path: rel,
      content,
      encoding,
    });
    return Response.json({
      ...written,
      requestedProjectId: projectId,
      encoding,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "write failed";
    const status = message.includes("not_found") ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}
