import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function read(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

const contracts = read("packages/contracts/src/chat.ts");
const renderer = read("web/src/components/chat/parts/PartRenderer.tsx");
const summaryCard = read("web/src/components/chat/parts/RequirementSummaryCard.tsx");

for (const kind of ["3d_requirements", "3d_requirement_summary", "3d_outline"]) {
  if (!contracts.includes(`"${kind}"`)) {
    throw new Error(`contracts missing ${kind}`);
  }
  if (!renderer.includes(`case "${kind}"`)) {
    throw new Error(`PartRenderer missing ${kind}`);
  }
}

for (const expected of [
  "IndustrialDrawingOutlineData",
  "blocks",
  "3D 需求摘要",
  "3D 建模方案",
]) {
  if (!summaryCard.includes(expected)) {
    throw new Error(`RequirementSummaryCard missing 3D support marker: ${expected}`);
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      parts: ["3d_requirements", "3d_requirement_summary", "3d_outline"],
      renderer: "PartRenderer",
      outlineBlocks: true,
    },
    null,
    2,
  ),
);
