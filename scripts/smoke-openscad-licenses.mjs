import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = mkdtempSync(join(tmpdir(), "jlc-openscad-licenses-"));
const sourceTree = join(root, "source");
const outputDir = join(root, "out");
const incompleteOut = join(root, "incomplete");

await mkdir(sourceTree, { recursive: true });
writeFileSync(join(sourceTree, "COPYING"), "GPL notice placeholder for smoke\n");
writeFileSync(join(sourceTree, "NOTICE"), "Third-party notices placeholder\n");

try {
  const ok = execFileSync("node", [
    "../scripts/prepare-openscad-licenses.mjs",
    "--source-tree",
    sourceTree,
    "--output",
    outputDir,
    "--source-code-url",
    "https://github.com/openscad/openscad",
    "--runtime-version",
    "OpenSCAD smoke",
  ], {
    cwd: new URL("../companion", import.meta.url),
    encoding: "utf8",
  });
  const result = JSON.parse(ok.slice(ok.indexOf("{")));
  if (result.ok !== true || result.copiedLicense !== true) {
    throw new Error("Expected license preparation smoke to succeed");
  }

  const sourceAvailability = readFileSync(
    join(outputDir, "SOURCE_AVAILABILITY.md"),
    "utf8",
  );
  const thirdParty = readFileSync(join(outputDir, "THIRD_PARTY_NOTICES.md"), "utf8");
  if (!sourceAvailability.includes("https://github.com/openscad/openscad")) {
    throw new Error("SOURCE_AVAILABILITY should include source URL");
  }
  if (!thirdParty.includes("NOTICE")) {
    throw new Error("THIRD_PARTY_NOTICES should list copied notices");
  }

  let requiredFailed = false;
  try {
    execFileSync("node", [
      "../scripts/prepare-openscad-licenses.mjs",
      "--required",
      "--output",
      incompleteOut,
    ], {
      cwd: new URL("../companion", import.meta.url),
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (err) {
    const output = `${err?.stdout ?? ""}${err?.stderr ?? ""}`;
    requiredFailed =
      output.includes("OpenSCAD LICENSE or COPYING file") &&
      output.includes("Source repository or source archive URL");
  }

  if (!requiredFailed) {
    throw new Error("Required license preparation should fail with missing inputs");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputDir,
        requiredMissingInputsGuard: requiredFailed,
      },
      null,
      2,
    ),
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
