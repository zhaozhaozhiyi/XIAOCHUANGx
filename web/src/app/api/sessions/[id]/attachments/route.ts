import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES =
  Number(process.env.XIAOCHUANG_MAX_UPLOAD_MB ?? 20) * 1024 * 1024;
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
  return path.resolve(
    process.env.XIAOCHUANG_ATTACHMENT_DIR ??
      path.join(process.cwd(), ".xiaochuang", "attachments"),
  );
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id?.trim()) {
    return Response.json({ error: "session id required" }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "invalid multipart body" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
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
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(dest, bytes);

  const extension = extensionOf(safeName);
  const mimeType = mimeFor(safeName, file.type);
  const postedText =
    typeof form.get("textContent") === "string"
      ? String(form.get("textContent")).slice(0, TEXT_ATTACHMENT_MAX_CHARS)
      : undefined;
  const textContent =
    postedText ??
    (isTextMime(mimeType, extension)
      ? bytes.toString("utf8").slice(0, TEXT_ATTACHMENT_MAX_CHARS)
      : undefined);
  const truncated =
    form.get("truncated") === "true" ||
    (textContent != null && bytes.toString("utf8").length > TEXT_ATTACHMENT_MAX_CHARS);

  return Response.json({
    id: crypto.randomUUID(),
    name: path.basename(dest),
    path: path.basename(dest),
    size: file.size,
    mimeType,
    isImage: mimeType.startsWith("image/"),
    extension,
    ...(textContent != null ? { textContent, truncated } : {}),
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
