/**
 * Build a normalized LICENSES directory for the packaged OpenSCAD runtime.
 *
 * Inputs are intentionally explicit. Release CI can point this script at an
 * extracted upstream source tree, an internal notices directory, or both. The
 * output is small text metadata that can be copied next to the runtime by
 * prepare-openscad-runtime.mjs.
 */
import { access, cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

const checkOnly = args.has("check");
const required = args.has("required") || process.env.JLC_OPENSCAD_REQUIRED === "1";
const sourceTree = args.get("source-tree") || process.env.JLC_OPENSCAD_SOURCE_TREE || "";
const noticesDir = args.get("notices-dir") || process.env.JLC_OPENSCAD_NOTICES_DIR || "";
const outputDir = resolve(
  args.get("output") ||
    process.env.JLC_OPENSCAD_LICENSES_OUT ||
    join(repoRoot, ".runtime", "openscad-license-notices"),
);
const sourceCodeUrl =
  args.get("source-code-url") || process.env.JLC_OPENSCAD_SOURCE_CODE_URL || "";
const sourceArchiveUrl =
  args.get("source-archive-url") || process.env.JLC_OPENSCAD_SOURCE_ARCHIVE_URL || "";
const sourceSha256 =
  args.get("source-sha256") || process.env.JLC_OPENSCAD_SOURCE_SHA256 || "";
const distUrl = args.get("dist-url") || process.env.JLC_OPENSCAD_DIST_URL || "";
const distSha256 = args.get("dist-sha256") || process.env.JLC_OPENSCAD_DIST_SHA256 || "";
const runtimeVersion =
  args.get("runtime-version") || process.env.JLC_OPENSCAD_RUNTIME_VERSION || "";

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function walk(root, depth = 0) {
  if (!root || depth > 5 || !(await exists(root))) return [];
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

function pickByName(paths, patterns) {
  return paths.find((path) => {
    const name = basename(path).toLowerCase();
    return patterns.some((pattern) => pattern.test(name));
  });
}

function pickAllByRelative(root, relatives) {
  if (!root) return [];
  return relatives.map((item) => join(root, item));
}

async function copyIfFile(source, target) {
  if (!source) return false;
  const info = await stat(source).catch(() => null);
  if (!info?.isFile()) return false;
  await cp(source, target);
  return true;
}

async function writeSourceAvailability() {
  await writeFile(
    join(outputDir, "SOURCE_AVAILABILITY.md"),
    [
      "# OpenSCAD Source Availability",
      "",
      "OpenSCAD is packaged as an independent runtime component for the 3D",
      "industrial drawing module.",
      "",
      runtimeVersion ? `- Runtime version: ${runtimeVersion}` : null,
      sourceCodeUrl ? `- Upstream source repository: ${sourceCodeUrl}` : null,
      sourceArchiveUrl ? `- Source archive URL: ${sourceArchiveUrl}` : null,
      sourceSha256 ? `- Source archive SHA256: ${sourceSha256}` : null,
      distUrl ? `- Runtime distribution URL: ${distUrl}` : null,
      distSha256 ? `- Runtime distribution SHA256: ${distSha256}` : null,
      "",
      "If OpenSCAD is modified before distribution, publish the corresponding",
      "source changes or patch set according to the upstream license obligations.",
      "",
    ]
      .filter(Boolean)
      .join("\n"),
    "utf8",
  );
}

async function writeThirdPartyNotice(input) {
  const lines = [
    "# Third-Party Notices",
    "",
    "This directory must include OpenSCAD upstream copyright, license, and",
    "third-party dependency attributions used by the packaged runtime.",
    "",
  ];

  if (input.copiedNotices.length > 0) {
    lines.push("Copied notice files:");
    for (const file of input.copiedNotices) {
      lines.push(`- ${file}`);
    }
    lines.push("");
  }

  if (input.missing.length > 0) {
    lines.push("Release checklist still requires review:");
    for (const item of input.missing) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  if (input.missing.length === 0) {
    lines.push(
      "This file is a packaging manifest for the notices copied into this",
      "directory. Keep the listed files with the packaged OpenSCAD runtime.",
      "",
    );
  } else {
    lines.push(
      "Do not treat this generated file as legal approval. It is a packaging",
      "manifest and release checklist input.",
      "",
    );
  }

  await writeFile(join(outputDir, "THIRD_PARTY_NOTICES.md"), lines.join("\n"), "utf8");
}

async function listOutputFiles() {
  return (await readdir(outputDir).catch(() => [])).filter(
    (entry) => !entry.startsWith("."),
  );
}

function hasAny(entries, patterns) {
  return entries.some((entry) =>
    patterns.some((pattern) => pattern.test(entry.toLowerCase())),
  );
}

async function fileContains(path, patterns) {
  const text = await readFile(path, "utf8").catch(() => "");
  return patterns.some((pattern) => pattern.test(text));
}

async function verifyPreparedOutput() {
  const entries = await listOutputFiles();
  const hasLicense = hasAny(entries, [/^license(\.|$)/, /^copying(\.|$)/]);
  const hasNotices = hasAny(entries, [
    /^notice(\.|$)/,
    /^third[_-]?party/,
    /^attribution/,
    /^copyright/,
    /license/,
  ]);
  const hasSourceNotice = hasAny(entries, [
    /^source(\.|$)/,
    /^source[_-]?offer/,
    /^source[_-]?availability/,
  ]);
  const thirdPartyPath = join(outputDir, "THIRD_PARTY_NOTICES.md");
  const unresolvedReview =
    entries.includes("THIRD_PARTY_NOTICES.md") &&
    (await fileContains(thirdPartyPath, [
      /Release checklist still requires review/,
      /Do not treat this generated file as legal approval/,
    ]));
  const errors = [];
  if (!hasLicense) errors.push("license_file_missing");
  if (!hasNotices) errors.push("notice_or_third_party_attribution_missing");
  if (!hasSourceNotice) errors.push("source_availability_notice_missing");
  if (unresolvedReview) errors.push("license_notices_require_review");

  return {
    ok: errors.length === 0,
    outputDir,
    files: entries,
    checks: {
      hasLicense,
      hasNotices,
      hasSourceNotice,
      unresolvedReview,
    },
    errors,
  };
}

async function main() {
  const config = {
    ok: true,
    checkOnly,
    required,
    sourceTree: sourceTree ? resolve(sourceTree) : null,
    noticesDir: noticesDir ? resolve(noticesDir) : null,
    outputDir,
    sourceCodeUrl: sourceCodeUrl || null,
    sourceArchiveUrl: sourceArchiveUrl || null,
    sourceSha256: sourceSha256 || null,
    distUrl: distUrl || null,
    distSha256: distSha256 || null,
    runtimeVersion: runtimeVersion || null,
  };

  if (checkOnly) {
    const result = await verifyPreparedOutput();
    console.log(JSON.stringify({ ...config, ...result }, null, 2));
    if (required && !result.ok) process.exitCode = 1;
    return;
  }

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const sourcePaths = await walk(sourceTree);
  const noticesPaths = await walk(noticesDir);
  const allPaths = [...noticesPaths, ...sourcePaths];

  const licenseSource = pickByName(allPaths, [
    /^copying(\.|$)/,
    /^license(\.|$)/,
  ]);
  const noticeSource = pickByName(allPaths, [
    /^notice(\.|$)/,
    /^third[_-]?party/,
    /^copyright(\.|$)/,
    /^acknowledg/,
  ]);
  const curatedNoticeSources = [
    ...pickAllByRelative(sourceTree, [
      "doc/contributor_copyright.txt",
      "doc/Python-LICENSE.txt",
      "libraries/MCAD/README.markdown",
      "libraries/MCAD/lgpl-2.1.txt",
      "src/libsvg/LICENSE",
      "fonts/Liberation-2.00.1/LICENSE",
      "fonts/Liberation-2.00.1/README",
      "examples/COPYING-CC0.txt",
      "icons/license.txt",
    ]),
    noticeSource,
  ].filter(Boolean);

  const copiedLicense = await copyIfFile(licenseSource, join(outputDir, "LICENSE"));
  const copiedNotices = [];
  const seenNoticeTargets = new Set();
  for (const source of curatedNoticeSources) {
    const targetName = basename(source);
    const target =
      targetName.toLowerCase() === "license"
        ? `${basename(dirname(source))}-LICENSE`
        : targetName;
    if (seenNoticeTargets.has(target)) continue;
    if (await copyIfFile(source, join(outputDir, target))) {
      seenNoticeTargets.add(target);
      copiedNotices.push(target);
    }
  }

  const missing = [];
  if (!copiedLicense) missing.push("OpenSCAD LICENSE or COPYING file");
  if (copiedNotices.length === 0) {
    missing.push("OpenSCAD NOTICE / copyright / third-party attribution files");
  }
  if (!sourceCodeUrl && !sourceArchiveUrl) {
    missing.push("Source repository or source archive URL");
  }

  await writeSourceAvailability();
  await writeThirdPartyNotice({ copiedNotices, missing });

  if (required && missing.length > 0) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          outputDir,
          copiedLicense,
          copiedNotices,
          missing,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputDir,
        copiedLicense,
        copiedNotices,
        missing,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
