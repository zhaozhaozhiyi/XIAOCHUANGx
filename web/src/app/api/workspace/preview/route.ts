import { hostAllowedForProxy, normalizeBrowserUrl } from "@/lib/browser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url");
  const target = raw ? normalizeBrowserUrl(raw) : null;
  if (!target) {
    return Response.json({ error: "invalid url" }, { status: 400 });
  }

  const { hostname } = new URL(target);
  if (!hostAllowedForProxy(hostname)) {
    return Response.json({ error: "host not allowed" }, { status: 403 });
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; JLCResearchPreview/1.0; +https://localhost)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

    const contentType = upstream.headers.get("content-type") ?? "text/html";
    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return Response.json({ error: "response too large" }, { status: 413 });
    }

    return new Response(buf, {
      status: upstream.status,
      headers: {
        "Content-Type": contentType.split(";")[0],
        "Cache-Control": "no-store",
        "X-Preview-Target": target,
      },
    });
  } catch {
    return Response.json({ error: "fetch failed" }, { status: 502 });
  }
}
