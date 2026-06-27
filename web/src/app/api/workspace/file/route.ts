import { readFile } from "node:fs/promises";
import path from "node:path";
import { inferMimeFromPath, isBinaryWorkspacePath } from "@/lib/workspace-binary";
import { chatExecutionMode, companionConfig } from "@/lib/companion/config";
import { fetchCompanionProjectFile } from "@/lib/companion/client";
import { resolveCompanionWorkspaceProjectId } from "@/lib/research-projects-server";
import { NO_PROJECT_ID, SANDBOX_PROJECT_ID } from "@/lib/research-projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LEGACY_PROJECT_ROOT = path.resolve(process.cwd(), "..");

function resolveLegacySafePath(relativePath: string): string | null {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) return null;
  const full = path.join(LEGACY_PROJECT_ROOT, normalized);
  if (!full.startsWith(LEGACY_PROJECT_ROOT)) return null;
  return full;
}

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
