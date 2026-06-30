#!/usr/bin/env node
/**
 * 3D M1 release gate.
 *
 * This is the hard pre-release check for the industrial drawing module. It
 * verifies the product-managed OpenSCAD CLI runtime, license/source notices,
 * browser WASM assets, WASM compile path, and the real UI preview path.
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const skipUi = args.has("--skip-ui") || process.env.JLC_3D_M1_SKIP_UI === "1";
const skipWasmCompile =
  args.has("--skip-wasm-compile") ||
  process.env.JLC_3D_M1_SKIP_WASM_COMPILE === "1";

const checks = [
  {
    name: "runtime release bundle",
    command: "node",
    args: ["scripts/verify-openscad-runtime.mjs", "--required"],
  },
  {
    name: "license material generator",
    command: "node",
    args: ["scripts/prepare-openscad-licenses.mjs", "--check", "--required"],
  },
  {
    name: "wasm assets",
    command: "node",
    args: ["scripts/prepare-openscad-wasm.mjs", "--check", "--required"],
  },
  ...(skipWasmCompile
    ? []
    : [
        {
          name: "wasm compile smoke",
          command: "pnpm",
          args: [
            "-s",
            "-C",
            "companion",
            "exec",
            "tsx",
            "--tsconfig",
            "../web/tsconfig.json",
            "../scripts/smoke-openscad-wasm-preview.ts",
          ],
        },
      ]),
  ...(skipUi
    ? []
    : [
        {
          name: "wasm UI preview",
          command: "pnpm",
          args: [
            "-s",
            "--filter",
            "web",
            "exec",
            "playwright",
            "test",
            "tests/e2e/3d-m1-release-gate.spec.ts",
            "--reporter=line",
            "--workers=1",
            "--timeout=60000",
          ],
          env: {
            NEXT_PUBLIC_OPENSCAD_WASM_PREVIEW: "1",
          },
        },
      ]),
];

function runCheck(check) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    console.log(`\n[3d-m1] ${check.name}`);
    console.log(`$ ${[check.command, ...check.args].join(" ")}`);
    const child = spawn(check.command, check.args, {
      cwd: repoRoot,
      env: {
        ...process.env,
        JLC_OPENSCAD_REQUIRED: "1",
        JLC_OPENSCAD_WASM_REQUIRED: "1",
        ...(check.env ?? {}),
      },
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("close", (code, signal) => {
      resolve({
        name: check.name,
        ok: code === 0,
        code,
        signal,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

const results = [];
for (const check of checks) {
  const result = await runCheck(check);
  results.push(result);
  if (!result.ok) break;
}

const failed = results.find((result) => !result.ok);
console.log(
  JSON.stringify(
    {
      ok: !failed,
      skipped: {
        ui: skipUi,
        wasmCompile: skipWasmCompile,
      },
      checks: results,
      failed: failed?.name ?? null,
    },
    null,
    2,
  ),
);

if (failed) process.exit(1);
