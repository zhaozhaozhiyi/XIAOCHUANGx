import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { uploadCompanionProjectFile } from "@/lib/companion/client";
import { chatExecutionMode, companionConfig } from "@/lib/companion/config";
import { resolveCompanionWorkspaceProjectId } from "@/lib/research-projects-server";
import { NO_PROJECT_ID } from "@/lib/research-projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES =
  Number(process.env.XIAOCHUANG_MAX_UPLOAD_MB ?? 20) * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_UPLOAD_BYTES + 2 * 1024 * 1024;
const TEXT_ATTACHMENT_MAX_CHARS = 60_000;

const MIME_BY_EXT: Record<string, string> = {
  ".csv": "text/csv",
  ".css": "text/css",
  ".html": "text/html",
  ".htm": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".md": "text/markdown",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ts": "text/typescript",
  ".tsx": "text/typescript",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".xml": "application/xml",
  ".yaml": "application/yaml",
  ".yml": "application/yaml",
};

function sanitizeSegment(value: string, fallback: string, max = 160): string {
  const safe = value.replace(/[^\w.\-\u4e00-\u9fa5]/g, "_").slice(0, max);
  return safe && safe.replace(/\./g, "") ? safe : fallback;
}

function attachmentsRoot(): string {
  const configured = process.env.XIAOCHUANG_ATTACHMENT_DIR?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(/*turbopackIgnore: true*/ process.cwd(), ".xiaochuang", "attachments");
}

function extensionOf(filename: string): string | undefined {
  const ext = path.extname(filename).replace(/^\./, "").toLowerCase();
  return ext || undefined;
}

function mimeFor(filename: string, fileType: string): string {
  if (fileType) return fileType;
  return MIME_BY_EXT[path.extname(filename).toLowerCase()] ?? "application/octet-stream";
}

function isTextMime(mimeType: string, extension?: string): boolean {
  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml"
  ) {
    return true;
  }
  if (!extension) return false;
  const textExtensions = new Set([
    "md",
    "csv",
    "yaml",
    "yml",
    "py",
    "sql",
    "jsx",
    "log",
  ]);
  return textExtensions.has(extension);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function uniqueDestination(dir: string, safeName: string): Promise<string> {
  const dest = path.join(dir, safeName);
  if (!(await fileExists(dest))) {
    return dest;
  }
  const parsed = path.parse(safeName);
  for (let idx = 1; idx < 1000; idx++) {
    const candidate = path.join(dir, `${parsed.name}-${idx}${parsed.ext}`);
    if (!(await fileExists(candidate))) {
      return candidate;
    }
  }
  throw new Error("Too many uploads with the same filename");
}

type MultipartFile = {
  name: string;
  type: string;
  size: number;
  bytes: Buffer;
};

type ParsedUpload = {
  file?: MultipartFile;
  fields: Map<string, string>;
  projectId?: string;
  error?: string;
  status?: number;
};

function multipartBoundary(contentType: string | null): string | null {
  const match = contentType?.match(/(?:^|;\s*)boundary=(?:"([^"]+)"|([^;]+))/i);
  return match?.[1] ?? match?.[2] ?? null;
}

function parseContentDisposition(value: string | undefined): {
  name?: string;
  filename?: string;
} {
  if (!value) return {};
  const result: { name?: string; filename?: string } = {};
  for (const part of value.split(";").slice(1)) {
    const [rawKey, ...rawValue] = part.split("=");
    const key = rawKey?.trim().toLowerCase();
    const joined = rawValue.join("=").trim();
    if (!key || !joined) continue;
    const decoded = joined.startsWith('"') && joined.endsWith('"')
      ? joined.slice(1, -1).replace(/\\"/g, '"')
      : joined;
    if (key === "name") result.name = decoded;
    if (key === "filename") result.filename = decoded;
  }
  return result;
}

function parseMultipartBody(body: Buffer, boundary: string): {
  file?: MultipartFile;
  fields: Map<string, string>;
} {
  const delimiter = Buffer.from(`--${boundary}`);
  const fields = new Map<string, string>();
  let file: MultipartFile | undefined;
  let cursor = 0;

  while (cursor < body.length) {
    const start = body.indexOf(delimiter, cursor);
    if (start < 0) break;
    const nextStart = body.indexOf(delimiter, start + delimiter.length);
    if (nextStart < 0) break;

    let part = body.subarray(start + delimiter.length, nextStart);
    cursor = nextStart;

    if (part.subarray(0, 2).toString("latin1") === "--") break;
    if (part.subarray(0, 2).toString("latin1") === "\r\n") {
      part = part.subarray(2);
    }
    if (part.subarray(-2).toString("latin1") === "\r\n") {
      part = part.subarray(0, -2);
    }

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd < 0) continue;

    const rawHeaders = part.subarray(0, headerEnd).toString("latin1");
    const content = part.subarray(headerEnd + 4);
    const headers = new Map<string, string>();
    for (const line of rawHeaders.split("\r\n")) {
      const sep = line.indexOf(":");
      if (sep <= 0) continue;
      headers.set(line.slice(0, sep).trim().toLowerCase(), line.slice(sep + 1).trim());
    }

    const disposition = parseContentDisposition(
      headers.get("content-disposition"),
    );
    if (!disposition.name) continue;

    if (disposition.name === "file") {
      file = {
        name: disposition.filename ?? "attachment",
        type: headers.get("content-type") ?? "",
        size: content.length,
        bytes: Buffer.from(content),
      };
      continue;
    }

    fields.set(disposition.name, content.toString("utf8"));
  }

  return { file, fields };
}

async function readJsonUpload(request: Request): Promise<ParsedUpload> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_MULTIPART_BYTES) {
    return {
      error: `file too large (max ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB)`,
      status: 413,
      fields: new Map(),
    };
  }

  try {
    const body = (await request.json()) as {
      name?: unknown;
      type?: unknown;
      size?: unknown;
      textContent?: unknown;
      truncated?: unknown;
      contentBase64?: unknown;
      projectId?: unknown;
    };
    const name = typeof body.name === "string" ? body.name : "";
    const type = typeof body.type === "string" ? body.type : "";
    const contentBase64 =
      typeof body.contentBase64 === "string" ? body.contentBase64 : "";
    if (!contentBase64) {
      return { error: "contentBase64 is required", status: 400, fields: new Map() };
    }

    const bytes = Buffer.from(contentBase64, "base64");
    const fields = new Map<string, string>();
    if (typeof body.textContent === "string") {
      fields.set("textContent", body.textContent);
    }
    if (body.truncated != null) {
      fields.set("truncated", String(body.truncated));
    }
    return {
      fields,
      projectId: typeof body.projectId === "string" ? body.projectId : undefined,
      file: {
        name: name || "attachment",
        type,
        size: typeof body.size === "number" ? body.size : bytes.length,
        bytes,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid json body";
    return { error: `invalid upload body: ${message}`, status: 400, fields: new Map() };
  }
}

async function readRawUpload(request: Request): Promise<ParsedUpload> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_UPLOAD_BYTES) {
    return {
      error: `file too large (max ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB)`,
      status: 413,
      fields: new Map(),
    };
  }

  try {
    const bytes = Buffer.from(await request.arrayBuffer());
    if (bytes.length > MAX_UPLOAD_BYTES) {
      return {
        error: `file too large (max ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB)`,
        status: 413,
        fields: new Map(),
      };
    }
    const encodedName = request.headers.get("x-jlc-file-name") ?? "";
    const name = encodedName
      ? decodeURIComponent(encodedName)
      : "attachment";
    const encodedProjectId = request.headers.get("x-jlc-project-id") ?? "";
    return {
      fields: new Map(),
      projectId: encodedProjectId
        ? decodeURIComponent(encodedProjectId)
        : undefined,
      file: {
        name,
        type: request.headers.get("content-type") ?? "",
        size: Number(request.headers.get("x-jlc-file-size") ?? bytes.length),
        bytes,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid raw body";
    return { error: `invalid upload body: ${message}`, status: 400, fields: new Map() };
  }
}

async function syncUploadToCompanion(input: {
  sessionId: string;
  projectId?: string;
  name: string;
  bytes: Buffer;
}): Promise<{ path: string; size: number } | null> {
  if (chatExecutionMode() !== "companion" || companionConfig.useMock) {
    return null;
  }
  const { workspaceProjectId } = await resolveCompanionWorkspaceProjectId(
    input.projectId?.trim() || NO_PROJECT_ID,
    {
      moduleId: "chat",
      taskId: input.sessionId,
      taskTitle: input.name,
    },
  );
  const uploaded = await uploadCompanionProjectFile({
    projectId: workspaceProjectId,
    name: input.name,
    bytes: input.bytes,
  });
  return { path: uploaded.path, size: uploaded.size };
}

async function readMultipartUpload(request: Request): Promise<ParsedUpload> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_MULTIPART_BYTES) {
    return {
      error: `file too large (max ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB)`,
      status: 413,
      fields: new Map(),
    };
  }

  const boundary = multipartBoundary(request.headers.get("content-type"));
  if (!boundary) {
    return { error: "multipart boundary is required", status: 400, fields: new Map() };
  }

  try {
    const body = Buffer.from(await request.arrayBuffer());
    if (body.length > MAX_MULTIPART_BYTES) {
      return {
        error: `file too large (max ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB)`,
        status: 413,
        fields: new Map(),
      };
    }
    return parseMultipartBody(body, boundary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid request body";
    return { error: `invalid multipart body: ${message}`, status: 400, fields: new Map() };
  }
}

async function readUpload(request: Request): Promise<ParsedUpload> {
  const contentType = request.headers.get("content-type") ?? "";
  if (request.headers.get("x-jlc-upload-mode") === "raw") {
    return readRawUpload(request);
  }
  if (contentType.toLowerCase().startsWith("application/json")) {
    return readJsonUpload(request);
  }
  return readMultipartUpload(request);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id?.trim()) {
    return Response.json({ error: "session id required" }, { status: 400 });
  }

  const { file, fields, projectId, error, status } = await readUpload(request);
  if (error) {
    return Response.json({ error }, { status: status ?? 400 });
  }
  if (!file) {
    return Response.json({ error: "file field is required" }, { status: 400 });
  }
  if (!file.name.trim()) {
    return Response.json({ error: "filename is required" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json(
      { error: `file too large (max ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB)` },
      { status: 413 },
    );
  }

  const root = attachmentsRoot();
  const sessionDir = path.join(root, sanitizeSegment(id, "session", 120));
  const safeName = sanitizeSegment(path.basename(file.name), "attachment");
  const dest = await uniqueDestination(sessionDir, safeName);
  const relativeDest = path.relative(sessionDir, dest);
  if (relativeDest.startsWith("..") || path.isAbsolute(relativeDest)) {
    return Response.json({ error: "invalid upload destination" }, { status: 400 });
  }

  await mkdir(sessionDir, { recursive: true });
  const bytes = file.bytes;
  await writeFile(dest, bytes);

  const extension = extensionOf(safeName);
  const mimeType = mimeFor(safeName, file.type);
  const postedText =
    typeof fields.get("textContent") === "string"
      ? String(fields.get("textContent")).slice(0, TEXT_ATTACHMENT_MAX_CHARS)
      : undefined;
  const textContent =
    postedText ??
    (isTextMime(mimeType, extension)
      ? bytes.toString("utf8").slice(0, TEXT_ATTACHMENT_MAX_CHARS)
      : undefined);
  const truncated =
    fields.get("truncated") === "true" ||
    (textContent != null && bytes.toString("utf8").length > TEXT_ATTACHMENT_MAX_CHARS);
  let workspaceUpload: { path: string; size: number } | null = null;
  let workspaceSyncError: string | undefined;
  try {
    workspaceUpload = await syncUploadToCompanion({
      sessionId: id,
      projectId,
      name: file.name,
      bytes,
    });
  } catch (error) {
    workspaceSyncError =
      error instanceof Error ? error.message : "companion_upload_failed";
  }

  return Response.json({
    id: crypto.randomUUID(),
    name: path.basename(dest),
    path: workspaceUpload?.path ?? path.basename(dest),
    size: workspaceUpload?.size ?? file.size,
    mimeType,
    isImage: mimeType.startsWith("image/"),
    extension,
    ...(textContent != null ? { textContent, truncated } : {}),
    ...(workspaceUpload ? {} : { contentBase64: bytes.toString("base64") }),
    ...(workspaceSyncError ? { workspaceSyncError } : {}),
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id?.trim()) {
    return Response.json({ error: "session id required" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name")?.trim();
  if (!name) {
    return Response.json({ error: "name parameter is required" }, { status: 400 });
  }

  const root = attachmentsRoot();
  const sessionDir = path.join(root, sanitizeSegment(id, "session", 120));
  const safeName = sanitizeSegment(path.basename(name), "attachment");
  const dest = path.join(sessionDir, safeName);
  const relativeDest = path.relative(sessionDir, dest);
  if (relativeDest.startsWith("..") || path.isAbsolute(relativeDest)) {
    return Response.json({ error: "invalid attachment path" }, { status: 400 });
  }

  try {
    const bytes = await readFile(dest);
    const mimeType = mimeFor(safeName, "");
    return new Response(bytes, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return Response.json({ error: "attachment not found" }, { status: 404 });
  }
}
