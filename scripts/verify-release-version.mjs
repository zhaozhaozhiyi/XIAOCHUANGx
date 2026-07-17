import { readFile } from "node:fs/promises";

const packageFiles = [
  "package.json",
  "web/package.json",
  "api/package.json",
  "companion/package.json",
  "apps/desktop/package.json",
  "apps/video/package.json",
  "packages/contracts/package.json",
  "packages/runtime-core/package.json",
];

const versions = await Promise.all(
  packageFiles.map(async (file) => {
    const pkg = JSON.parse(await readFile(file, "utf8"));
    return { file, version: pkg.version };
  }),
);
const expected = versions[0].version;
const mismatches = versions.filter(({ version }) => version !== expected);
if (mismatches.length > 0) {
  throw new Error(
    `package version mismatch: expected ${expected}; ${mismatches
      .map(({ file, version }) => `${file}=${version}`)
      .join(", ")}`,
  );
}

const companionConfig = await readFile("companion/src/config.ts", "utf8");
const companionVersion = /PACKAGE_VERSION\s*=\s*"([^"]+)"/.exec(
  companionConfig,
)?.[1];
if (companionVersion !== expected) {
  throw new Error(
    `companion PACKAGE_VERSION mismatch: expected ${expected}, got ${companionVersion ?? "missing"}`,
  );
}

if (process.env.GITHUB_REF_TYPE === "tag") {
  const tag = process.env.GITHUB_REF_NAME ?? "";
  if (tag !== `v${expected}`) {
    throw new Error(`tag/version mismatch: tag=${tag}, package=v${expected}`);
  }
}

console.log(`PASS release version ${expected} (${packageFiles.length} packages + Companion)`);
