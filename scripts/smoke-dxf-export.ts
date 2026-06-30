import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseScadParameters } from "../web/src/lib/scad-parameters.ts";
import {
  buildDxfFromScadParameters,
  createDxfProjectionSource,
  normalizeOpenScadDxf,
} from "../web/src/lib/scad-dxf-export.ts";
import { parseDxfPreview } from "../web/src/lib/dxf-preview.ts";

const source = `
/* [Base] */
// 底板长
base_length = 132; // [40:1:240]
// 底板宽
base_width = 86; // [30:1:180]
// 孔径
hole_diameter = 9; // [3:0.5:20]
// 孔边距
hole_edge = 16; // [8:1:48]

module part() {
  cube([base_length, base_width, 8]);
}
`;

function countEntities(dxf: string, entity: string): number {
  return (dxf.match(new RegExp(`\\n0\\n${entity}\\n`, "g")) ?? []).length;
}

function assertProjectionWrapper(): void {
  const projection = createDxfProjectionSource(`
// use <ignored.scad>
use <real-lib.scad>
base_length = 40;
cube([base_length, 20, 4]);
`);

  if (!projection.startsWith("use <real-lib.scad>")) {
    throw new Error("Projection wrapper did not preserve global imports");
  }
  if (!projection.includes("module __jlc_projection_source__()")) {
    throw new Error("Projection wrapper did not create a source module");
  }
  if (!projection.includes("projection(cut = false)")) {
    throw new Error("Projection wrapper missing OpenSCAD projection call");
  }
  const importBlock = projection.slice(
    0,
    projection.indexOf("module __jlc_projection_source__()"),
  );
  if (importBlock.includes("use <ignored.scad>")) {
    throw new Error("Projection wrapper treated commented imports as active");
  }
}

function assertOpenScadDxfNormalization(): void {
  const raw = `0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
0
70
1
10
0
20
0
10
12
20
0
10
12
20
8
10
0
20
8
0
ENDSEC
0
EOF
`;
  const normalized = normalizeOpenScadDxf(raw);
  if (!normalized.includes("AC1009")) {
    throw new Error("Normalized DXF is not AutoCAD R12");
  }
  if (normalized.includes("LWPOLYLINE")) {
    throw new Error("Normalized DXF still contains LWPOLYLINE");
  }
  if (countEntities(normalized, "LINE") !== 4) {
    throw new Error("Normalized DXF did not convert closed polyline to 4 lines");
  }
  if (!normalized.includes("12.000000") || !normalized.includes("8.000000")) {
    throw new Error("Normalized DXF extents do not reflect input geometry");
  }
}

async function main(): Promise<void> {
  assertProjectionWrapper();
  assertOpenScadDxfNormalization();

  const parameters = parseScadParameters(source);
  const dxf = buildDxfFromScadParameters(parameters);
  const outputDir = "/tmp/jlc-3d-dxf-smoke";
  const outputPath = join(outputDir, "drawing.dxf");
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, dxf, "utf8");

  const persisted = await readFile(outputPath, "utf8");
  const lineCount = countEntities(persisted, "LINE");
  const circleCount = countEntities(persisted, "CIRCLE");
  const preview = parseDxfPreview(persisted);

  if (!persisted.includes("AC1009")) {
    throw new Error("DXF is not AutoCAD R12");
  }
  if (!persisted.includes("$INSUNITS")) {
    throw new Error("DXF unit metadata missing");
  }
  if (lineCount !== 4) {
    throw new Error(`Expected 4 outline LINE entities, got ${lineCount}`);
  }
  if (circleCount !== 4) {
    throw new Error(`Expected 4 hole CIRCLE entities, got ${circleCount}`);
  }
  if (!persisted.includes("132.000000") || !persisted.includes("86.000000")) {
    throw new Error("DXF extents do not reflect parsed SCAD dimensions");
  }
  if (preview.entities.length !== 8) {
    throw new Error(`Expected 8 preview entities, got ${preview.entities.length}`);
  }
  if (!preview.layers.includes("OUTLINE") || !preview.layers.includes("HOLES")) {
    throw new Error("DXF preview layers missing");
  }
  if (preview.bounds.maxX !== 132 || preview.bounds.maxY !== 86) {
    throw new Error("DXF preview bounds do not match generated dimensions");
  }
  if (preview.stats.lineCount !== 4 || preview.stats.circleCount !== 4) {
    throw new Error("DXF preview stats do not match generated entities");
  }
  if (preview.stats.uniqueCircleDiameters[0] !== 9) {
    throw new Error("DXF preview did not detect the generated hole diameter");
  }
  const expectedCutLength = 2 * (132 + 86) + 4 * 2 * Math.PI * 4.5;
  if (Math.abs(preview.stats.totalCutLength - expectedCutLength) > 0.01) {
    throw new Error("DXF preview total cut length is incorrect");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        path: outputPath,
        parameters: parameters.length,
        lineCount,
        circleCount,
        previewEntities: preview.entities.length,
        totalCutLength: Number(preview.stats.totalCutLength.toFixed(3)),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
