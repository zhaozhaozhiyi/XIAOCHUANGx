import { POST } from "../web/src/app/api/workspace/cad/export/route.ts";
import { probeOpenScadToolchain } from "../web/src/lib/cad-toolchain.ts";

const projectId = "test-cad-export";
const files = new Map<string, { content: string; encoding?: "utf8" | "base64" }>();

const scad = `/* [Main Dimensions] */
base_length = 120; // [40:5:300]
base_width = 80; // [30:5:200]
base_thickness = 8; // [3:1:30]
hole_diameter = 8; // [4:1:30]

cube([base_length, base_width, base_thickness]);
`;

files.set("drawing.scad", { content: scad, encoding: "utf8" });

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
    return jsonResponse({ error: "unexpected_request", url: String(input) }, { status: 500 });
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
    const res = await POST(
      new Request("http://localhost/api/workspace/cad/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          path: "drawing.scad",
          source: scad,
          formats: ["dxf", "svg", "pdf", "stl"],
        }),
      }),
    );
    const json = (await res.json()) as {
      ok?: boolean;
      items?: Array<{
        format: string;
        path: string;
        status: string;
        method?: string;
        error?: string;
        engine?: string;
      }>;
    };
    const toolchain = await probeOpenScadToolchain();

    const dxf = json.items?.find((item) => item.format === "dxf");
    const svg = json.items?.find((item) => item.format === "svg");
    const pdf = json.items?.find((item) => item.format === "pdf");
    const stl = json.items?.find((item) => item.format === "stl");
    const commonOk =
      res.status === 200 &&
      json.ok === true &&
      dxf?.status === "generated" &&
      svg?.status === "generated" &&
      svg.method === "parameter_outline" &&
      pdf?.status === "generated" &&
      pdf.method === "parameter_outline" &&
      files.has("exports/drawing.dxf") &&
      files.has("exports/drawing.svg") &&
      files.has("exports/drawing.pdf") &&
      files.get("exports/drawing.pdf")?.encoding === "base64" &&
      files.has("drawing.parameters.json");
    const openScadOk = toolchain.available
      ? dxf?.method === "openscad_projection" &&
        dxf.engine === "openscad-cli" &&
        stl?.status === "generated" &&
        stl.method === "openscad_export" &&
        stl.engine === "openscad-cli" &&
        files.has("exports/drawing.stl")
      : dxf?.method === "parameter_outline" &&
        stl?.status === "failed" &&
        stl.error === "openscad_unavailable" &&
        !files.has("exports/drawing.stl");
    const ok = commonOk && openScadOk;

    console.log(
      JSON.stringify(
        {
          ok,
          status: res.status,
          openscadAvailable: toolchain.available,
          items: json.items,
          writtenPaths: [...files.keys()].sort(),
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
