import { readFile } from "node:fs/promises";
import path from "node:path";
import { chatExecutionMode, companionConfig } from "@/lib/companion/config";
import { fetchCompanionProjectFile } from "@/lib/companion/client";
import { resolveCompanionWorkspaceProjectId } from "@/lib/research-projects-server";
import { NO_PROJECT_ID, SANDBOX_PROJECT_ID } from "@/lib/research-projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LEGACY_PROJECT_ROOT = path.resolve(process.cwd(), "..");

const DOWNLOADABLE_EXT = new Set(["pptx", "ppt", "html", "htm"]);

function resolveLegacySafePath(relativePath: string): string | null {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) return null;
  const full = path.join(LEGACY_PROJECT_ROOT, normalized);
  if (!full.startsWith(LEGACY_PROJECT_ROOT)) return null;
  return full;
}

function basenameFromPath(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || "presentation";
}

function mimeForPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pptx" || ext === "ppt") {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (ext === "html" || ext === "htm") return "text/html; charset=utf-8";
  return "application/octet-stream";
}

async function readFileBytes(
  filePath: string,
  projectId: string,
): Promise<{ bytes: Buffer; mime: string }> {
  if (
    chatExecutionMode() === "companion" &&
    !companionConfig.useMock
  ) {
    const { workspaceProjectId } =
      await resolveCompanionWorkspaceProjectId(projectId);
    const file = await fetchCompanionProjectFile(
      workspaceProjectId,
      filePath.trim(),
    );
    const bytes =
      file.encoding === "base64"
        ? Buffer.from(file.content, "base64")
        : Buffer.from(file.content, "utf8");
    return { bytes, mime: file.mime ?? mimeForPath(filePath) };
  }

  const full = resolveLegacySafePath(filePath.trim());
  if (!full) throw new Error("invalid_path");
  const bytes = await readFile(full);
  return { bytes, mime: mimeForPath(filePath) };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const filePath =
    body &&
    typeof body === "object" &&
    typeof (body as { filePath?: string }).filePath === "string"
      ? (body as { filePath: string }).filePath.trim()
      : "";
  const projectId =
    body &&
    typeof body === "object" &&
    typeof (body as { projectId?: string }).projectId === "string"
      ? (body as { projectId: string }).projectId.trim()
      : SANDBOX_PROJECT_ID;

  if (!filePath) {
    return Response.json({ error: "filePath is required" }, { status: 400 });
  }

  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  if (!DOWNLOADABLE_EXT.has(ext)) {
    return Response.json(
      { error: "unsupported_file_type" },
      { status: 400 },
    );
  }

  if (projectId === NO_PROJECT_ID) {
    return Response.json({ error: "workspace_not_ready" }, { status: 409 });
  }

  try {
    const { bytes, mime } = await readFileBytes(filePath, projectId);
    const name = basenameFromPath(filePath);
    // V1.1 收口（2026-06-08）：Node 22 起 Buffer<ArrayBufferLike> 不再直接
    // 满足 BodyInit 约束（已知 web tsc 历史债，commit 0a22e3b 提交说明点过名）。
    // 转 Uint8Array 兼顾 Buffer 子类与 BodyInit 形态。
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(name)}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "read_failed";
    const status = message.includes("not_found") ? 404 : 400;
    return Response.json({ error: message }, { status });
  }
}
