import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { chatExecutionMode, companionConfig } from "@/lib/companion/config";
import { fetchCompanionProjectFile } from "@/lib/companion/client";
import { resolveCompanionWorkspaceProjectId } from "@/lib/research-projects-server";
import { NO_PROJECT_ID, SANDBOX_PROJECT_ID } from "@/lib/research-projects";
import { resolveLegacySafePath } from "@/lib/legacy-workspace-path";
import { resolveOpenScadExecutable } from "@/lib/cad-toolchain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const MAX_SCAD_BYTES = 2 * 1024 * 1024;

async function readScadFromWorkspace(
  projectId: string,
  relativePath: string,
): Promise<string> {
  if (projectId === NO_PROJECT_ID) {
    throw new Error("workspace_not_ready");
  }

  if (chatExecutionMode() === "companion" && !companionConfig.useMock) {
    const { workspaceProjectId } =
      await resolveCompanionWorkspaceProjectId(projectId);
    const file = await fetchCompanionProjectFile(
      workspaceProjectId,
      relativePath,
    );
    if (file.encoding === "base64") {
      return Buffer.from(file.content, "base64").toString("utf8");
    }
    return file.content;
  }

  const full = resolveLegacySafePath(relativePath);
  if (!full) throw new Error("invalid path");
  return readFile(full, "utf8");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rel = url.searchParams.get("path")?.trim();
  const projectId =
    url.searchParams.get("projectId")?.trim() || SANDBOX_PROJECT_ID;

  if (!rel) {
    return Response.json({ error: "path is required" }, { status: 400 });
  }
  if (!rel.toLowerCase().endsWith(".scad")) {
    return Response.json({ error: "scad_required" }, { status: 400 });
  }

  let tempDir: string | null = null;
  try {
    const source = await readScadFromWorkspace(projectId, rel);
    if (Buffer.byteLength(source, "utf8") > MAX_SCAD_BYTES) {
      return Response.json({ error: "scad_too_large" }, { status: 413 });
    }

    tempDir = await mkdtemp(join(tmpdir(), "jlc-scad-"));
    const inputPath = join(tempDir, "drawing.scad");
    const outputPath = join(tempDir, "drawing.stl");
    await writeFile(inputPath, source, "utf8");

    const openscad = await resolveOpenScadExecutable();
    if (!openscad) throw new Error("openscad_runtime_missing");

    await execFileAsync(openscad.command, ["-o", outputPath, inputPath], {
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });

    const stl = await readFile(outputPath);
    return Response.json({
      mime: "model/stl",
      encoding: "base64",
      content: stl.toString("base64"),
      compiler: "openscad",
      engine: "openscad-cli",
      engineSource: openscad.source,
    });
  } catch (err) {
    const e = err as NodeJS.ErrnoException & {
      stderr?: string;
      stdout?: string;
      killed?: boolean;
    };
    if (e.code === "ENOENT") {
      return Response.json(
        { error: "openscad_unavailable" },
        { status: 501 },
      );
    }
    if (e.message === "openscad_runtime_missing") {
      return Response.json(
        {
          error: "openscad_unavailable",
          detail: "产品内置 OpenSCAD Runtime 尚未就绪。",
        },
        { status: 501 },
      );
    }
    if (e.message === "workspace_not_ready") {
      return Response.json({ error: e.message }, { status: 409 });
    }
    if (e.message === "invalid path") {
      return Response.json({ error: e.message }, { status: 400 });
    }
    return Response.json(
      {
        error: e.killed ? "openscad_timeout" : "openscad_compile_failed",
        detail: (e.stderr || e.stdout || e.message || "").slice(0, 4000),
      },
      { status: 422 },
    );
  } finally {
    if (tempDir) {
      await rm(tempDir, { force: true, recursive: true }).catch(() => {});
    }
  }
}
