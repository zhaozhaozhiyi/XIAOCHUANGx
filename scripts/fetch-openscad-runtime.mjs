/**
 * Download and prepare a product-managed OpenSCAD runtime bundle.
 *
 * This script intentionally requires an explicit upstream URL. We do not pin a
 * moving "latest" URL in code because release binaries, hashes, and signing
 * status can change independently of this repository.
 */
import { createHash } from "node:crypto";
import { constants, createReadStream, createWriteStream } from "node:fs";
import { access, chmod, cp, lstat, mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { pipeline } from "node:stream/promises";

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map();

for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith("--")) continue;
  const key = arg.slice(2);
  const next = process.argv[i + 1];
  if (!next || next.startsWith("--")) {
    args.set(key, "1");
  } else {
    args.set(key, next);
    i += 1;
  }
}

const platform = args.get("platform") || process.env.JLC_OPENSCAD_PLATFORM || process.platform;
const required = args.has("required") || process.env.JLC_OPENSCAD_REQUIRED === "1";
const checkOnly = args.has("check");
const keepCache = args.has("keep-cache") || process.env.JLC_OPENSCAD_KEEP_CACHE === "1";
const distUrl = args.get("url") || process.env.JLC_OPENSCAD_DIST_URL || "";
const archivePath = args.get("archive") || process.env.JLC_OPENSCAD_ARCHIVE || "";
const sha256 = (args.get("sha256") || process.env.JLC_OPENSCAD_DIST_SHA256 || "").toLowerCase();
const licensesDir = args.get("licenses-dir") || process.env.JLC_OPENSCAD_LICENSES_DIR || "";
const sourceCodeUrl =
  args.get("source-code-url") || process.env.JLC_OPENSCAD_SOURCE_CODE_URL || "";
const cacheDir = resolve(
  args.get("cache-dir") ||
    process.env.JLC_OPENSCAD_CACHE_DIR ||
    join(repoRoot, ".runtime", "openscad-downloads", platform),
);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function isValidSha256(value) {
  return /^[a-f0-9]{64}$/.test(value);
}

function inferFileName(url) {
  try {
    const parsed = new URL(url);
    const name = basename(parsed.pathname);
    return name || `openscad-runtime-${platform}`;
  } catch {
    return `openscad-runtime-${platform}`;
  }
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function download(url, target, redirects = 0) {
  if (redirects > 5) {
    throw new Error("too_many_redirects");
  }
  const getter = url.startsWith("http://") ? httpGet : httpsGet;
  return new Promise((resolveDownload, reject) => {
    const req = getter(url, (res) => {
      const location = res.headers.location;
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        location
      ) {
        const nextUrl = new URL(location, url).toString();
        res.resume();
        resolveDownload(download(nextUrl, target, redirects + 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`download_failed_${res.statusCode ?? "unknown"}`));
        return;
      }
      pipeline(res, createWriteStream(target)).then(resolveDownload, reject);
    });
    req.on("error", reject);
  });
}

async function sha256File(path) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

async function ensureDownloaded() {
  if (archivePath) {
    const archive = resolve(archivePath);
    if (!(await exists(archive))) {
      fail(`OpenSCAD archive does not exist: ${archive}`);
    }
    const actual = await sha256File(archive);
    if (sha256 && actual !== sha256) {
      fail(`OpenSCAD runtime SHA256 mismatch. expected=${sha256} actual=${actual}`);
    }
    if (required && !sha256) {
      fail(`Missing SHA256 for release runtime. actual=${actual}`);
    }
    return { archive, sha256: actual };
  }

  if (!distUrl) {
    fail(
      "Set JLC_OPENSCAD_ARCHIVE, JLC_OPENSCAD_DIST_URL, --archive, or --url to fetch OpenSCAD runtime.",
    );
  }
  if (required && !isValidSha256(sha256)) {
    fail("Release runtime fetch requires JLC_OPENSCAD_DIST_SHA256 or --sha256.");
  }
  if (sha256 && !isValidSha256(sha256)) {
    fail("Invalid OpenSCAD SHA256. Expected 64 lowercase/uppercase hex chars.");
  }

  await mkdir(cacheDir, { recursive: true });
  const archive = join(cacheDir, inferFileName(distUrl));
  if (!(await exists(archive))) {
    await download(distUrl, archive);
  }

  const actual = await sha256File(archive);
  if (sha256 && actual !== sha256) {
    await rm(archive, { force: true });
    fail(`OpenSCAD runtime SHA256 mismatch. expected=${sha256} actual=${actual}`);
  }
  if (required && !sha256) {
    fail(`Missing SHA256 for release runtime. actual=${actual}`);
  }
  return { archive, sha256: actual };
}

async function walk(root, depth = 0) {
  if (depth > 8) return [];
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const results = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    results.push(path);
    if (entry.isDirectory()) {
      results.push(...(await walk(path, depth + 1)));
    }
  }
  return results;
}

async function isExecutable(path) {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function findRuntimeSource(root) {
  const paths = await walk(root);
  let macApp = null;
  for (const path of paths) {
    if (platform !== "darwin" || basename(path) !== "OpenSCAD.app") continue;
    const linkInfo = await lstat(path).catch(() => null);
    if (linkInfo?.isSymbolicLink()) continue;
    const info = await stat(path).catch(() => null);
    if (info?.isDirectory()) {
      macApp = path;
      break;
    }
  }
  if (macApp) return { type: "source", path: macApp };

  const appImage = paths.find(
    (path) => platform === "linux" && basename(path).toLowerCase().endsWith(".appimage"),
  );
  if (appImage) {
    await chmod(appImage, 0o755).catch(() => {});
    return { type: "bin", path: appImage };
  }

  const binaryName = platform === "win32" ? "openscad.exe" : "openscad";
  for (const path of paths) {
    if (basename(path).toLowerCase() !== binaryName.toLowerCase()) continue;
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) continue;
    if (platform !== "win32") await chmod(path, 0o755).catch(() => {});
    if (platform === "win32" || (await isExecutable(path))) {
      return { type: "bin", path };
    }
  }
  return null;
}

async function extractArchive(archive) {
  const lower = archive.toLowerCase();
  const temp = await mkdtemp(join(tmpdir(), "jlc-openscad-runtime-"));

  if (lower.endsWith(".dmg")) {
    if (process.platform !== "darwin") {
      throw new Error("dmg_extraction_requires_macos");
    }
    const mountPoint = join(temp, "mount");
    await mkdir(mountPoint, { recursive: true });
    await execFileAsync("hdiutil", [
      "attach",
      archive,
      "-nobrowse",
      "-readonly",
      "-mountpoint",
      mountPoint,
    ]);
    return { root: mountPoint, cleanup: async () => {
      await execFileAsync("hdiutil", ["detach", mountPoint]).catch(() => {});
      if (!keepCache) await rm(temp, { recursive: true, force: true });
    } };
  }

  const extractRoot = join(temp, "extract");
  await mkdir(extractRoot, { recursive: true });

  if (lower.endsWith(".zip")) {
    await execFileAsync("unzip", ["-q", archive, "-d", extractRoot]);
    return { root: extractRoot, cleanup: async () => {
      if (!keepCache) await rm(temp, { recursive: true, force: true });
    } };
  }

  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) {
    await execFileAsync("tar", ["-xzf", archive, "-C", extractRoot]);
    return { root: extractRoot, cleanup: async () => {
      if (!keepCache) await rm(temp, { recursive: true, force: true });
    } };
  }

  if (lower.endsWith(".appimage")) {
    await chmod(archive, 0o755).catch(() => {});
    return { root: dirname(archive), cleanup: async () => {} };
  }

  if (extname(lower) === ".exe") {
    await chmod(archive, 0o755).catch(() => {});
    return { root: dirname(archive), cleanup: async () => {} };
  }

  throw new Error(
    "unsupported_runtime_archive. Use macOS .dmg, Windows .zip, Linux .AppImage, or .tar.gz.",
  );
}

async function runPrepare(source, actualSha256) {
  const env = {
    ...process.env,
    JLC_OPENSCAD_PLATFORM: platform,
    JLC_OPENSCAD_REQUIRED: required ? "1" : process.env.JLC_OPENSCAD_REQUIRED || "",
    JLC_OPENSCAD_DIST_URL: distUrl,
    JLC_OPENSCAD_DIST_SHA256: actualSha256,
    JLC_OPENSCAD_SOURCE_CODE_URL: sourceCodeUrl,
  };
  if (licensesDir) env.JLC_OPENSCAD_LICENSES_DIR = licensesDir;
  if (source.type === "bin") {
    env.JLC_OPENSCAD_BIN = source.path;
    delete env.JLC_OPENSCAD_SOURCE;
  } else {
    env.JLC_OPENSCAD_SOURCE = source.path;
    delete env.JLC_OPENSCAD_BIN;
  }
  await execFileAsync("node", [join(repoRoot, "scripts", "prepare-openscad-runtime.mjs")], {
    cwd: repoRoot,
    env,
    maxBuffer: 1024 * 1024,
  });
}

async function main() {
  const config = {
    ok: true,
    checkOnly,
    platform,
    required,
    distUrl: distUrl || null,
    archivePath: archivePath || null,
    hasSha256: Boolean(sha256),
    licensesDir: licensesDir || null,
    sourceCodeUrl: sourceCodeUrl || null,
    cacheDir,
  };
  if (checkOnly) {
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  const downloaded = await ensureDownloaded();
  const extracted = await extractArchive(downloaded.archive);
  try {
    const source = await findRuntimeSource(extracted.root);
    if (!source) {
      throw new Error("openscad_runtime_not_found_in_archive");
    }
    await runPrepare(source, downloaded.sha256);
    console.log(
      JSON.stringify(
        {
          ok: true,
          platform,
          archive: downloaded.archive,
          sha256: downloaded.sha256,
          preparedFrom: source,
        },
        null,
        2,
      ),
    );
  } finally {
    await extracted.cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
