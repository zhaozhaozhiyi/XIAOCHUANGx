import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { resolveOpenScadExecutable } from "@/lib/cad-toolchain";
import { chatExecutionMode, companionConfig } from "@/lib/companion/config";
import {
  fetchCompanionProjectFile,
  writeCompanionProjectFile,
} from "@/lib/companion/client";
import { resolveCompanionWorkspaceProjectId } from "@/lib/research-projects-server";
import { NO_PROJECT_ID, SANDBOX_PROJECT_ID } from "@/lib/research-projects";
import {
  buildDxfFromScadParameters,
  buildPdfFromScadParameters,
  buildSvgFromScadParameters,
  createDxfProjectionSource,
  normalizeOpenScadDxf,
} from "@/lib/scad-dxf-export";
import {
  parametersToJson,
  parseScadParameters,
} from "@/lib/scad-parameters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const MAX_SCAD_BYTES = 2 * 1024 * 1024;

type ExportFormat = "dxf" | "svg" | "pdf" | "stl";

type ExportItem = {
  format: ExportFormat;
  path: string;
  status: "generated" | "failed";
  method?: "openscad_projection" | "openscad_export" | "parameter_outline";
  warning?: string;
  error?: string;
  engine?: "openscad-cli";
  engineSource?: "env" | "bundled" | "dev_path";
};

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(0, idx) : "";
}

function siblingPath(path: string, name: string): string {
  const dir = dirname(path);
  return dir ? `${dir}/${name}` : name;
}

function uniqueFormats(input: unknown): ExportFormat[] {
  const raw = Array.isArray(input) ? input : ["dxf"];
  const out: ExportFormat[] = [];
  for (const item of raw) {
    if (
      (item === "dxf" || item === "svg" || item === "pdf" || item === "stl") &&
      !out.includes(item)
    ) {
      out.push(item);
    }
  }
  return out.length ? out : ["dxf"];
}

async function resolveWorkspaceProject(projectId: string): Promise<string> {
  if (projectId === NO_PROJECT_ID) throw new Error("workspace_not_ready");
  if (chatExecutionMode() !== "companion" || companionConfig.useMock) {
    throw new Error("workspace_write_unavailable");
  }
  const { workspaceProjectId } =
    await resolveCompanionWorkspaceProjectId(projectId);
  return workspaceProjectId;
}

async function readWorkspaceText(
  workspaceProjectId: string,
  relativePath: string,
): Promise<string> {
  const file = await fetchCompanionProjectFile(workspaceProjectId, relativePath);
  if (file.encoding === "base64") {
    return Buffer.from(file.content, "base64").toString("utf8");
  }
  return file.content;
}

async function writeWorkspaceContent(input: {
  workspaceProjectId: string;
  path: string;
  content: string;
  encoding?: "utf8" | "base64";
}): Promise<void> {
  await writeCompanionProjectFile({
    projectId: input.workspaceProjectId,
    path: input.path,
    content: input.content,
    encoding: input.encoding ?? "utf8",
  });
}

async function compileWithOpenScad(input: {
  source: string;
  outputExtension: "stl" | "dxf";
  projection?: boolean;
}): Promise<{
  content: Buffer;
  engineSource: "env" | "bundled" | "dev_path";
}> {
  const openscad = await resolveOpenScadExecutable();
  if (!openscad) throw new Error("openscad_unavailable");

  let tempDir: string | null = null;
  try {
    tempDir = await mkdtemp(join(tmpdir(), "jlc-scad-export-"));
    const inputPath = join(tempDir, "drawing.scad");
    const outputPath = join(tempDir, `drawing.${input.outputExtension}`);
    await writeFile(
      inputPath,
      input.projection ? createDxfProjectionSource(input.source) : input.source,
      "utf8",
    );
    await execFileAsync(openscad.command, ["-o", outputPath, inputPath], {
      timeout: 30_000,
      maxBuffer: input.outputExtension === "dxf" ? 8 * 1024 * 1024 : 4 * 1024 * 1024,
    });
    return {
      content: await readFile(outputPath),
      engineSource: openscad.source,
    };
  } finally {
    if (tempDir) {
      await rm(tempDir, { force: true, recursive: true }).catch(() => {});
    }
  }
}

function exportErrorMessage(err: unknown): string {
  const e = err as NodeJS.ErrnoException & {
    stderr?: string;
    stdout?: string;
    killed?: boolean;
  };
  if (e.message === "openscad_unavailable" || e.code === "ENOENT") {
    return "openscad_unavailable";
  }
  if (e.killed) return "openscad_timeout";
  return (e.stderr || e.stdout || e.message || "export_failed").slice(0, 2000);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    body = parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const projectId =
    typeof body.projectId === "string" && body.projectId.trim()
      ? body.projectId.trim()
      : SANDBOX_PROJECT_ID;
  const rel = typeof body.path === "string" ? body.path.trim() : "";
  const sourceOverride =
    typeof body.source === "string" ? body.source : undefined;
  const formats = uniqueFormats(body.formats);

  if (!rel) {
    return Response.json({ error: "path is required" }, { status: 400 });
  }
  if (!rel.toLowerCase().endsWith(".scad")) {
    return Response.json({ error: "scad_required" }, { status: 400 });
  }

  try {
    const workspaceProjectId = await resolveWorkspaceProject(projectId);
    if (sourceOverride != null) {
      await writeWorkspaceContent({
        workspaceProjectId,
        path: rel,
        content: sourceOverride,
      });
    }

    const source = sourceOverride ?? await readWorkspaceText(workspaceProjectId, rel);
    if (Buffer.byteLength(source, "utf8") > MAX_SCAD_BYTES) {
      return Response.json({ error: "scad_too_large" }, { status: 413 });
    }

    const parameters = parseScadParameters(source);
    const items: ExportItem[] = [];

    if (formats.includes("dxf")) {
      const dxfPath = siblingPath(rel, "exports/drawing.dxf");
      try {
        const compiled = await compileWithOpenScad({
          source,
          outputExtension: "dxf",
          projection: true,
        });
        await writeWorkspaceContent({
          workspaceProjectId,
          path: dxfPath,
          content: normalizeOpenScadDxf(compiled.content.toString("utf8")),
        });
        items.push({
          format: "dxf",
          path: dxfPath,
          status: "generated",
          method: "openscad_projection",
          engine: "openscad-cli",
          engineSource: compiled.engineSource,
        });
      } catch (err) {
        const warning = exportErrorMessage(err);
        await writeWorkspaceContent({
          workspaceProjectId,
          path: dxfPath,
          content: buildDxfFromScadParameters(parameters),
        });
        items.push({
          format: "dxf",
          path: dxfPath,
          status: "generated",
          method: "parameter_outline",
          warning,
        });
      }
    }

    if (formats.includes("svg")) {
      const svgPath = siblingPath(rel, "exports/drawing.svg");
      await writeWorkspaceContent({
        workspaceProjectId,
        path: svgPath,
        content: buildSvgFromScadParameters(parameters),
      });
      items.push({
        format: "svg",
        path: svgPath,
        status: "generated",
        method: "parameter_outline",
      });
    }

    if (formats.includes("pdf")) {
      const pdfPath = siblingPath(rel, "exports/drawing.pdf");
      await writeWorkspaceContent({
        workspaceProjectId,
        path: pdfPath,
        content: Buffer.from(buildPdfFromScadParameters(parameters), "utf8").toString(
          "base64",
        ),
        encoding: "base64",
      });
      items.push({
        format: "pdf",
        path: pdfPath,
        status: "generated",
        method: "parameter_outline",
      });
    }

    if (formats.includes("stl")) {
      const stlPath = siblingPath(rel, "exports/drawing.stl");
      try {
        const compiled = await compileWithOpenScad({
          source,
          outputExtension: "stl",
        });
        await writeWorkspaceContent({
          workspaceProjectId,
          path: stlPath,
          content: compiled.content.toString("base64"),
          encoding: "base64",
        });
        items.push({
          format: "stl",
          path: stlPath,
          status: "generated",
          method: "openscad_export",
          engine: "openscad-cli",
          engineSource: compiled.engineSource,
        });
      } catch (err) {
        items.push({
          format: "stl",
          path: stlPath,
          status: "failed",
          error: exportErrorMessage(err),
        });
      }
    }

    const dxfItem = items.find((item) => item.format === "dxf");
    await writeWorkspaceContent({
      workspaceProjectId,
      path: siblingPath(rel, "drawing.parameters.json"),
      content: parametersToJson({
        title: rel.split("/").slice(-2, -1)[0],
        parameters,
        dxfStatus: dxfItem?.status === "generated" ? "generated" : "on_demand",
        dxfMethod: dxfItem?.method === "openscad_projection" ||
          dxfItem?.method === "parameter_outline"
          ? dxfItem.method
          : undefined,
        dxfWarning: dxfItem?.warning,
      }),
    });

    const ok = items.some((item) => item.status === "generated");
    return Response.json(
      {
        ok,
        projectId,
        workspaceProjectId,
        sourcePath: rel,
        items,
      },
      { status: ok ? 200 : 422 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "export_failed";
    const status =
      message === "workspace_not_ready"
        ? 409
        : message === "workspace_write_unavailable"
          ? 409
          : 400;
    return Response.json({ error: message }, { status });
  }
}
