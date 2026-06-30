import { execFileSync } from "node:child_process";

const check = execFileSync("node", [
  "../scripts/fetch-openscad-runtime.mjs",
  "--check",
], {
  cwd: new URL("../companion", import.meta.url),
  encoding: "utf8",
});

const config = JSON.parse(check.slice(check.indexOf("{")));
if (config.ok !== true || config.checkOnly !== true) {
  throw new Error("OpenSCAD fetch check did not return an ok checkOnly result");
}
if (!config.cacheDir || typeof config.cacheDir !== "string") {
  throw new Error("OpenSCAD fetch check did not expose cacheDir");
}

let requiredFailed = false;
try {
  execFileSync("node", [
    "../scripts/fetch-openscad-runtime.mjs",
    "--required",
    "--url",
    "https://example.invalid/OpenSCAD-runtime.dmg",
  ], {
    cwd: new URL("../companion", import.meta.url),
    encoding: "utf8",
    stdio: "pipe",
  });
} catch (err) {
  const output = `${(err as { stdout?: Buffer; stderr?: Buffer }).stdout ?? ""}${
    (err as { stderr?: Buffer }).stderr ?? ""
  }`;
  requiredFailed = output.includes("requires JLC_OPENSCAD_DIST_SHA256");
}

if (!requiredFailed) {
  throw new Error("Release fetch should fail before download when SHA256 is missing");
}

let requiredVerifyOk = false;
let archGuardFailed = false;
let requiredArchitectures: string[] = [];
try {
  const output = execFileSync("node", [
    "../scripts/verify-openscad-runtime.mjs",
    "--required",
  ], {
    cwd: new URL("../companion", import.meta.url),
    encoding: "utf8",
    stdio: "pipe",
    env: {
      ...process.env,
      JLC_OPENSCAD_REQUIRED_ARCHES: "x86_64,arm64",
    },
  });
  const result = JSON.parse(output.slice(output.indexOf("{")));
  requiredVerifyOk =
    result.ok === true &&
    Array.isArray(result.architectures) &&
    result.architectures.includes("x86_64") &&
    result.architectures.includes("arm64");
  requiredArchitectures = result.requiredArchitectures ?? [];
} catch (err) {
  const output = `${(err as { stdout?: Buffer; stderr?: Buffer }).stdout ?? ""}${
    (err as { stderr?: Buffer }).stderr ?? ""
  }`;
  archGuardFailed =
    output.includes("runtime_arch_missing:x86_64") &&
    output.includes("runtime_arch_missing:arm64");
}

if (!requiredVerifyOk && !archGuardFailed) {
  throw new Error(
    "Release verifier should either pass with required architectures or fail on missing architectures",
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      checkOnly: config.checkOnly,
      requiredMissingShaGuard: requiredFailed,
      requiredVerifyOk,
      requiredArchGuard: archGuardFailed,
      requiredArchitectures,
    },
    null,
    2,
  ),
);
