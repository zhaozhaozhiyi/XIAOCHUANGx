import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import {
  companionConfig,
  companionProjectMediaUrl,
  chatExecutionMode,
} from "@/lib/companion/config";
import { resolveCompanionWorkspaceProjectId } from "@/lib/research-projects-server";
import { NO_PROJECT_ID, SANDBOX_PROJECT_ID } from "@/lib/research-projects";
import { resolveLegacySafePath } from "@/lib/legacy-workspace-path";
import {
  inferMimeFromPath,
  isStreamableWorkspacePath,
} from "@/lib/workspace-binary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ByteRange =
  | { ok: true; partial: boolean; start: number; end: number }
  | { ok: false };

function parseByteRange(rangeHeader: string | null, size: number): ByteRange {
  if (size <= 0) return { ok: false };
  if (!rangeHeader) return { ok: true, partial: false, start: 0, end: size - 1 };
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return { ok: false };
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return { ok: false };

  let start: number;
  let end: number;
  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return { ok: false };
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : size - 1;
  }

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return { ok: false };
  }

  return { ok: true, partial: true, start, end: Math.min(end, size - 1) };
}

function forwardedMediaHeaders(upstream: Response): Headers {
  const headers = new Headers();
  for (const key of [
    "accept-ranges",
    "cache-control",
    "content-length",
    "content-range",
    "content-type",
  ]) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }
  headers.set("Cache-Control", "no-store");
  return headers;
}

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rel = url.searchParams.get("path")?.trim() ?? "";
  const projectId =
    url.searchParams.get("projectId")?.trim() || SANDBOX_PROJECT_ID;

  if (!rel) return jsonError("path is required", 400);
  if (projectId === NO_PROJECT_ID) return jsonError("workspace_not_ready", 409);
  if (!isStreamableWorkspacePath(rel)) {
    return jsonError("unsupported_media_type", 415);
  }

  if (chatExecutionMode() === "companion" && !companionConfig.useMock) {
    try {
      const { workspaceProjectId } =
        await resolveCompanionWorkspaceProjectId(projectId);
      const headers = new Headers();
      const range = request.headers.get("range");
      if (range) headers.set("Range", range);
      if (companionConfig.apiToken) {
        headers.set("Authorization", `Bearer ${companionConfig.apiToken}`);
      }
      const upstream = await fetch(
        companionProjectMediaUrl(workspaceProjectId, rel),
        {
          headers,
          signal: request.signal,
        },
      );
      return new Response(upstream.body, {
        status: upstream.status,
        headers: forwardedMediaHeaders(upstream),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "media read failed";
      const status = message.includes("not_found") ? 404 : 400;
      return jsonError(message, status);
    }
  }

  const full = resolveLegacySafePath(rel);
  if (!full) return jsonError("invalid path", 400);

  try {
    const st = await stat(full);
    if (!st.isFile()) return jsonError("not_a_file", 400);
    const range = parseByteRange(request.headers.get("range"), st.size);
    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
      "Content-Type": inferMimeFromPath(rel),
    });
    if (!range.ok) {
      headers.set("Content-Range", `bytes */${st.size}`);
      return new Response(null, { status: 416, headers });
    }

    const stream = createReadStream(full, {
      start: range.start,
      end: range.end,
    });
    headers.set("Content-Length", String(range.end - range.start + 1));
    if (range.partial) {
      headers.set("Content-Range", `bytes ${range.start}-${range.end}/${st.size}`);
    }
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: range.partial ? 206 : 200,
      headers,
    });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return jsonError("file not found", 404);
    return jsonError("read failed", 500);
  }
}
