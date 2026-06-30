import {
  GET,
  PUT,
} from "../web/src/app/api/workspace/file/route.ts";

const projectId = "test-workspace-file-edit";
const files = new Map<string, { content: string; encoding?: "utf8" | "base64" }>();

function jsonResponse(payload: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(payload), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

const originalFetch = globalThis.fetch;

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  const projectMatch = url.pathname.match(/^\/v1\/projects\/([^/]+)\/files$/);
  if (!projectMatch || projectMatch[1] !== projectId) {
    return jsonResponse(
      { error: "unexpected_request", url: String(input) },
      { status: 500 },
    );
  }

  if ((init?.method ?? "GET").toUpperCase() === "PUT") {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      path?: string;
      content?: string;
      encoding?: "utf8" | "base64";
    };
    if (!body.path || typeof body.content !== "string") {
      return jsonResponse({ error: "invalid_write" }, { status: 400 });
    }
    files.set(body.path, {
      content: body.content,
      encoding: body.encoding ?? "utf8",
    });
    return jsonResponse({
      projectId,
      path: body.path,
      size: body.content.length,
    });
  }

  const rel = url.searchParams.get("path") ?? "";
  const file = files.get(rel);
  if (!file) return jsonResponse({ error: "not_found" }, { status: 404 });
  return jsonResponse({
    content: file.content,
    encoding: file.encoding ?? "utf8",
  });
};

async function main() {
  try {
    const path = "工业制图/2026-06-26-安装支架/drawing.scad";
    const source = [
      "base_length = 120;",
      "base_width = 80;",
      "cube([base_length, base_width, 8]);",
      "",
    ].join("\n");

    const put = await PUT(
      new Request("http://localhost/api/workspace/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          path,
          content: source,
          encoding: "utf8",
        }),
      }),
    );
    const putJson = (await put.json()) as { path?: string; encoding?: string };

    const get = await GET(
      new Request(
        `http://localhost/api/workspace/file?projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(path)}`,
      ),
    );
    const getJson = (await get.json()) as {
      content?: string;
      encoding?: string;
    };

    const ok =
      put.status === 200 &&
      get.status === 200 &&
      putJson.path === path &&
      getJson.content === source &&
      getJson.encoding === "utf8";

    console.log(
      JSON.stringify(
        {
          ok,
          putStatus: put.status,
          getStatus: get.status,
          path: putJson.path,
          encoding: getJson.encoding,
          length: getJson.content?.length ?? 0,
        },
        null,
        2,
      ),
    );

    if (!ok) process.exitCode = 1;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
