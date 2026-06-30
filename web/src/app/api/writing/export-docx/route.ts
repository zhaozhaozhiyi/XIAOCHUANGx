import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
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

const execFileAsync = promisify(execFile);
function basenameFromPath(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || "document";
}

async function readMarkdownSource(
  filePath: string,
  projectId: string,
): Promise<string> {
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
    if (file.encoding === "base64") {
      return Buffer.from(file.content, "base64").toString("utf8");
    }
    return file.content;
  }

  const full = resolveLegacySafePath(filePath.trim());
  if (!full) throw new Error("invalid_path");
  return readFile(full, "utf8");
}

function docxPathForMarkdown(filePath: string): string {
  return filePath.trim().replace(/\.md$/i, ".docx");
}

async function writeDocxToWorkspace(input: {
  filePath: string;
  projectId: string;
  docx: Buffer;
}): Promise<{ path: string; mime?: string; size: number }> {
  const outputRelPath = docxPathForMarkdown(input.filePath);
  if (
    chatExecutionMode() === "companion" &&
    !companionConfig.useMock
  ) {
    const { workspaceProjectId } =
      await resolveCompanionWorkspaceProjectId(input.projectId);
    const written = await writeCompanionProjectFile({
      projectId: workspaceProjectId,
      path: outputRelPath,
      content: input.docx.toString("base64"),
      encoding: "base64",
    });
    return {
      path: written.path,
      mime: written.mime,
      size: written.size,
    };
  }

  const full = resolveLegacySafePath(outputRelPath);
  if (!full) throw new Error("invalid_path");
  await writeFile(full, input.docx);
  return {
    path: outputRelPath,
    mime:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: input.docx.byteLength,
  };
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
  const writeToWorkspace =
    Boolean(body) &&
    typeof body === "object" &&
    (body as { writeToWorkspace?: unknown }).writeToWorkspace === true;

  if (!filePath) {
    return Response.json({ error: "filePath is required" }, { status: 400 });
  }
  if (!filePath.toLowerCase().endsWith(".md")) {
    return Response.json(
      { error: "only_markdown_supported" },
      { status: 400 },
    );
  }
  if (projectId === NO_PROJECT_ID) {
    return Response.json({ error: "workspace_not_ready" }, { status: 409 });
  }

  let markdown: string;
  try {
    markdown = await readMarkdownSource(filePath, projectId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "read_failed";
    const status = message.includes("not_found") ? 404 : 400;
    return Response.json({ error: message }, { status });
  }

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "jlc-docx-"));
  const base = basenameFromPath(filePath).replace(/\.md$/i, "") || "document";
  const inputPath = path.join(tmpDir, `${base}.md`);
  const outputPath = path.join(tmpDir, `${base}.docx`);

  try {
    await writeFile(inputPath, markdown, "utf8");
    await execFileAsync("pandoc", [inputPath, "-o", outputPath], {
      timeout: 120_000,
    });
    const docx = await readFile(outputPath);
    if (writeToWorkspace) {
      const written = await writeDocxToWorkspace({
        filePath,
        projectId,
        docx,
      });
      return Response.json({
        ok: true,
        path: written.path,
        mime:
          written.mime ??
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: written.size,
      });
    }
    return new Response(docx, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(base)}.docx"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "export_failed";
    const isMissingPandoc =
      message.includes("ENOENT") && message.includes("pandoc");
    return Response.json(
      {
        error: isMissingPandoc ? "pandoc_not_installed" : "export_failed",
        message: isMissingPandoc
          ? "未检测到 Pandoc，请先安装：brew install pandoc"
          : message,
      },
      { status: isMissingPandoc ? 503 : 500 },
    );
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
