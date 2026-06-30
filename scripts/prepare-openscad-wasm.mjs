/**
 * Prepare the browser OpenSCAD WebAssembly preview bundle.
 *
 * The desktop CLI runtime remains the authoritative CAD engine. These assets
 * are copied into web/public so the SCAD preview panel can run a same-origin
 * Web Worker for fast client-side previews.
 */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = join(repoRoot, "web", "public", "openscad-wasm");
const archivePath = process.env.JLC_OPENSCAD_WASM_ARCHIVE
  ? resolve(repoRoot, process.env.JLC_OPENSCAD_WASM_ARCHIVE)
  : join(
      repoRoot,
      ".runtime",
      "openscad-downloads",
      "wasm",
      "OpenSCAD-2026.06.21-WebAssembly-web.zip",
    );
const sourceDir = process.env.JLC_OPENSCAD_WASM_SOURCE
  ? resolve(repoRoot, process.env.JLC_OPENSCAD_WASM_SOURCE)
  : "";
const distUrl =
  process.env.JLC_OPENSCAD_WASM_DIST_URL ||
  "https://files.openscad.org/snapshots/OpenSCAD-2026.06.21-WebAssembly-web.zip";
const distSha256 = process.env.JLC_OPENSCAD_WASM_DIST_SHA256 || "";
const sourceCodeUrl =
  process.env.JLC_OPENSCAD_SOURCE_CODE_URL ||
  process.env.JLC_OPENSCAD_WASM_SOURCE_CODE_URL ||
  "https://github.com/openscad/openscad";
const required =
  process.argv.includes("--required") ||
  process.env.JLC_OPENSCAD_WASM_REQUIRED === "1";
const checkOnly = process.argv.includes("--check");

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function sha256(path) {
  const hash = createHash("sha256");
  hash.update(await readFile(path));
  return hash.digest("hex");
}

async function fileInfo(path) {
  if (!(await exists(path))) return null;
  return {
    path,
    size: (await stat(path)).size,
    sha256: await sha256(path),
  };
}

async function unzipArchive(archive) {
  const temp = await mkdtemp(join(tmpdir(), "jlc-openscad-wasm-"));
  await execFileAsync("unzip", ["-q", archive, "-d", temp], {
    timeout: 30_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  return temp;
}

async function findAssetRoot(root) {
  const directJs = join(root, "openscad.js");
  const directWasm = join(root, "openscad.wasm");
  if ((await exists(directJs)) && (await exists(directWasm))) return root;
  throw new Error(`openscad_wasm_assets_missing:${root}`);
}

async function writeMetadata(input) {
  const sourceAvailability = [
    "# OpenSCAD WASM Source Availability",
    "",
    "This directory contains the browser WebAssembly preview build used by the industrial drawing module.",
    "",
    `- Upstream source code: ${sourceCodeUrl}`,
    `- Distribution URL: ${distUrl}`,
    input.archiveSha256 ? `- Distribution SHA256: ${input.archiveSha256}` : "",
    "",
    "The WebAssembly preview is an enhancement path. Authoritative exports remain handled by the product-managed OpenSCAD CLI runtime.",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  await writeFile(
    join(publicRoot, "SOURCE_AVAILABILITY.md"),
    sourceAvailability,
    "utf8",
  );
  await writeFile(
    join(publicRoot, "VERSION.txt"),
    [
      "runtime=openscad-wasm-preview",
      "version=OpenSCAD 2026.06.21 WebAssembly web snapshot",
      `distUrl=${distUrl}`,
      input.archiveSha256 ? `distSha256=${input.archiveSha256}` : "",
      `preparedAt=${new Date().toISOString()}`,
      "",
    ]
      .filter(Boolean)
      .join("\n"),
    "utf8",
  );
  await writeFile(
    join(publicRoot, "WASM_MANIFEST.json"),
    JSON.stringify(
      {
        runtime: "openscad-wasm-preview",
        version: "OpenSCAD-2026.06.21-WebAssembly-web",
        distUrl,
        distSha256: input.archiveSha256 || null,
        sourceCodeUrl,
        preparedAt: new Date().toISOString(),
        files: {
          "openscad.js": input.js,
          "openscad.wasm": input.wasm,
        },
      },
      null,
      2,
    ),
    "utf8",
  );
}

async function verifyPrepared() {
  const js = await fileInfo(join(publicRoot, "openscad.js"));
  const wasm = await fileInfo(join(publicRoot, "openscad.wasm"));
  const manifest = await fileInfo(join(publicRoot, "WASM_MANIFEST.json"));
  const version = await fileInfo(join(publicRoot, "VERSION.txt"));
  const source = await fileInfo(join(publicRoot, "SOURCE_AVAILABILITY.md"));
  const errors = [];

  if (!js) errors.push("openscad_js_missing");
  if (!wasm) errors.push("openscad_wasm_missing");
  if (!manifest) errors.push("wasm_manifest_missing");
  if (!version) errors.push("wasm_version_missing");
  if (!source) errors.push("wasm_source_availability_missing");
  if (wasm && wasm.size < 1024 * 1024) errors.push("openscad_wasm_too_small");

  const result = {
    ok: errors.length === 0,
    required,
    publicRoot,
    files: {
      "openscad.js": js,
      "openscad.wasm": wasm,
      "WASM_MANIFEST.json": manifest,
      "VERSION.txt": version,
      "SOURCE_AVAILABILITY.md": source,
    },
    errors,
  };
  console.log(JSON.stringify(result, null, 2));
  if (errors.length > 0 && required) process.exitCode = 1;
  return result;
}

async function prepare() {
  let temp = "";
  let assetRoot = sourceDir;
  let archiveSha256 = "";

  if (!assetRoot) {
    if (!(await exists(archivePath))) {
      if (required) throw new Error(`openscad_wasm_archive_missing:${archivePath}`);
      await mkdir(publicRoot, { recursive: true });
      await writeFile(
        join(publicRoot, "MISSING_WASM.md"),
        [
          "# OpenSCAD WASM Preview Missing",
          "",
          "Run `pnpm engines:prepare:openscad-wasm` with `JLC_OPENSCAD_WASM_ARCHIVE` to enable browser-side previews.",
          "",
        ].join("\n"),
        "utf8",
      );
      return verifyPrepared();
    }
    archiveSha256 = await sha256(archivePath);
    if (distSha256 && archiveSha256 !== distSha256) {
      throw new Error(
        `openscad_wasm_archive_sha256_mismatch:${archiveSha256}:${distSha256}`,
      );
    }
    temp = await unzipArchive(archivePath);
    assetRoot = temp;
  }

  assetRoot = await findAssetRoot(assetRoot);
  await mkdir(publicRoot, { recursive: true });
  await rm(join(publicRoot, "MISSING_WASM.md"), { force: true });
  await copyFile(join(assetRoot, "openscad.js"), join(publicRoot, "openscad.js"));
  await copyFile(join(assetRoot, "openscad.wasm"), join(publicRoot, "openscad.wasm"));

  const js = await fileInfo(join(publicRoot, "openscad.js"));
  const wasm = await fileInfo(join(publicRoot, "openscad.wasm"));
  await writeMetadata({
    archiveSha256,
    js: { size: js.size, sha256: js.sha256, name: basename(js.path) },
    wasm: { size: wasm.size, sha256: wasm.sha256, name: basename(wasm.path) },
  });

  if (temp) await rm(temp, { recursive: true, force: true });
  return verifyPrepared();
}

if (checkOnly) {
  await verifyPrepared();
} else {
  await prepare();
}
