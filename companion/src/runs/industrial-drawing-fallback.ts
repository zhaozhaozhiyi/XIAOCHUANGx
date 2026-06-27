import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

type Vec3 = [number, number, number];

export type IndustrialDrawingFallbackResult = {
  relativePaths: string[];
};

export type IndustrialDrawingPreviewFallbackResult = {
  relativePaths: string[];
  sourceScadPath: string;
};

function nowStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function triangle(normal: Vec3, a: Vec3, b: Vec3, c: Vec3): string {
  const v = (p: Vec3) => `      vertex ${p[0]} ${p[1]} ${p[2]}`;
  return [
    `  facet normal ${normal[0]} ${normal[1]} ${normal[2]}`,
    "    outer loop",
    v(a),
    v(b),
    v(c),
    "    endloop",
    "  endfacet",
  ].join("\n");
}

function cuboid(name: string, origin: Vec3, size: Vec3): string {
  const [x, y, z] = origin;
  const [w, d, h] = size;
  const p = {
    nwb: [x, y, z] as Vec3,
    neb: [x + w, y, z] as Vec3,
    seb: [x + w, y + d, z] as Vec3,
    swb: [x, y + d, z] as Vec3,
    nwt: [x, y, z + h] as Vec3,
    net: [x + w, y, z + h] as Vec3,
    set: [x + w, y + d, z + h] as Vec3,
    swt: [x, y + d, z + h] as Vec3,
  };

  return [
    `  // ${name}`,
    triangle([0, 0, -1], p.nwb, p.seb, p.neb),
    triangle([0, 0, -1], p.nwb, p.swb, p.seb),
    triangle([0, 0, 1], p.nwt, p.net, p.set),
    triangle([0, 0, 1], p.nwt, p.set, p.swt),
    triangle([0, -1, 0], p.nwb, p.neb, p.net),
    triangle([0, -1, 0], p.nwb, p.net, p.nwt),
    triangle([1, 0, 0], p.neb, p.seb, p.set),
    triangle([1, 0, 0], p.neb, p.set, p.net),
    triangle([0, 1, 0], p.seb, p.swb, p.swt),
    triangle([0, 1, 0], p.seb, p.swt, p.set),
    triangle([-1, 0, 0], p.swb, p.nwb, p.nwt),
    triangle([-1, 0, 0], p.swb, p.nwt, p.swt),
  ].join("\n");
}

function buildPreviewStl(): string {
  return [
    "solid jlc_industrial_preview",
    cuboid("base_plate", [-55, -35, 0], [110, 70, 8]),
    cuboid("upright_plate", [-55, 26, 8], [110, 8, 70]),
    cuboid("left_gusset", [-42, 8, 8], [14, 18, 54]),
    cuboid("right_gusset", [28, 8, 8], [14, 18, 54]),
    "endsolid jlc_industrial_preview",
  ].join("\n");
}

function clampDimension(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || value == null) return fallback;
  return Math.min(2000, Math.max(1, value));
}

function parseScadNumbers(scad: string): Record<string, number> {
  const values: Record<string, number> = {};
  const assignmentPattern =
    /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(-?\d+(?:\.\d+)?)\s*;/gm;
  for (const match of scad.matchAll(assignmentPattern)) {
    const name = match[1];
    const raw = match[2];
    if (!name || !raw) continue;
    const value = Number(raw);
    if (Number.isFinite(value)) values[name] = value;
  }
  return values;
}

function parseParameterNumbers(raw: string | null): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const parameters = (parsed as { parameters?: unknown }).parameters;
    if (!Array.isArray(parameters)) return {};
    const values: Record<string, number> = {};
    for (const parameter of parameters) {
      if (!parameter || typeof parameter !== "object") continue;
      const record = parameter as { name?: unknown; value?: unknown };
      if (typeof record.name !== "string") continue;
      const value = Number(record.value);
      if (Number.isFinite(value)) values[record.name] = value;
    }
    return values;
  } catch {
    return {};
  }
}

function pickNumber(
  values: Record<string, number>,
  names: string[],
  fallback: number,
): number {
  for (const name of names) {
    const value = values[name];
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}

function buildPreviewStlFromScad(scad: string, parametersJson: string | null): string {
  const values = {
    ...parseScadNumbers(scad),
    ...parseParameterNumbers(parametersJson),
  };
  const baseLength = clampDimension(
    pickNumber(values, ["base_length", "length", "plate_length", "width"], 110),
    110,
  );
  const baseWidth = clampDimension(
    pickNumber(values, ["base_width", "depth", "plate_width"], 70),
    70,
  );
  const baseThickness = clampDimension(
    pickNumber(values, ["base_thickness", "plate_thickness", "thickness"], 8),
    8,
  );
  const uprightHeight = clampDimension(
    pickNumber(values, ["upright_height", "height", "wall_height"], 70),
    70,
  );
  const uprightThickness = clampDimension(
    pickNumber(values, ["upright_thickness", "wall_thickness"], baseThickness),
    baseThickness,
  );
  const ribWidth = clampDimension(
    pickNumber(values, ["rib_width", "gusset_width", "support_width"], 14),
    14,
  );
  const ribDepth = Math.max(
    8,
    Math.min(baseWidth / 2 - uprightThickness - 8, baseWidth * 0.35),
  );
  const ribHeight = clampDimension(
    pickNumber(values, ["rib_height", "gusset_height"], uprightHeight * 0.72),
    uprightHeight * 0.72,
  );

  return [
    "solid jlc_industrial_preview_from_scad",
    cuboid(
      "base_plate",
      [-baseLength / 2, -baseWidth / 2, 0],
      [baseLength, baseWidth, baseThickness],
    ),
    cuboid(
      "upright_plate",
      [
        -baseLength / 2,
        baseWidth / 2 - uprightThickness,
        baseThickness,
      ],
      [baseLength, uprightThickness, uprightHeight],
    ),
    cuboid(
      "left_gusset",
      [-baseLength * 0.34 - ribWidth / 2, 6, baseThickness],
      [ribWidth, ribDepth, ribHeight],
    ),
    cuboid(
      "right_gusset",
      [baseLength * 0.34 - ribWidth / 2, 6, baseThickness],
      [ribWidth, ribDepth, ribHeight],
    ),
    "endsolid jlc_industrial_preview_from_scad",
  ].join("\n");
}

async function readOptionalUtf8(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

async function firstExistingScad(input: {
  cwd: string;
  cadSourcePaths: string[];
}): Promise<{ relPath: string; absPath: string } | null> {
  const candidates = [...new Set(input.cadSourcePaths.map(normalizeRelativePath))]
    .filter((path) => path.toLowerCase().endsWith(".scad"));
  for (const relPath of candidates) {
    const absPath = join(input.cwd, relPath);
    if (await pathExists(absPath)) return { relPath, absPath };
  }
  return null;
}

function buildScad(userText: string): string {
  const brief = JSON.stringify(userText.slice(0, 160));
  return `/* [Main Dimensions] */
base_length = 110; // [40:5:300]
base_width = 70; // [30:5:200]
base_thickness = 8; // [3:1:30]
upright_height = 70; // [20:5:200]
upright_thickness = 8; // [3:1:30]
rib_width = 14; // [6:1:40]
hole_diameter = 10; // [4:1:30]
body_color = "LightSlateGray";

// Source brief: ${brief}
$fn = 64;

module mounting_holes() {
  for (x = [-base_length / 2 + 18, base_length / 2 - 18])
    for (y = [-base_width / 2 + 16, base_width / 2 - 16])
      translate([x, y, -1])
        cylinder(h = base_thickness + 2, d = hole_diameter);
}

module base_plate() {
  difference() {
    translate([-base_length / 2, -base_width / 2, 0])
      cube([base_length, base_width, base_thickness]);
    mounting_holes();
  }
}

module upright_plate() {
  translate([-base_length / 2, base_width / 2 - upright_thickness, base_thickness])
    cube([base_length, upright_thickness, upright_height]);
}

module rib(x_offset) {
  translate([x_offset - rib_width / 2, 8, base_thickness])
    cube([rib_width, base_width / 2 - upright_thickness - 8, upright_height * 0.78]);
}

color(body_color) {
  base_plate();
  upright_plate();
  rib(-base_length * 0.32);
  rib(base_length * 0.32);
}
`;
}

function buildParameters(userText: string, targetDirLabel: string): string {
  return `${JSON.stringify(
    {
      engine: "openscad",
      title: "industrial drawing preview",
      brief: userText.slice(0, 300),
      directory: targetDirLabel,
      parameters: [
        { name: "base_length", label: "base length", value: 110, unit: "mm", min: 40, max: 300, step: 5 },
        { name: "base_width", label: "base width", value: 70, unit: "mm", min: 30, max: 200, step: 5 },
        { name: "base_thickness", label: "base thickness", value: 8, unit: "mm", min: 3, max: 30, step: 1 },
        { name: "upright_height", label: "upright height", value: 70, unit: "mm", min: 20, max: 200, step: 5 },
        { name: "hole_diameter", label: "hole diameter", value: 10, unit: "mm", min: 4, max: 30, step: 1 },
      ],
      exports: [
        { format: "scad", path: "drawing.scad", status: "generated" },
        {
          format: "stl",
          path: "exports/preview.stl",
          status: "preview_generated",
          source: "agent_ascii_stl_preview",
        },
      ],
    },
    null,
    2,
  )}\n`;
}

function buildReadme(userText: string): string {
  return [
    "# Industrial Drawing Preview",
    "",
    "This folder was generated as a fallback 3D module draft because no CAD artifact was detected after the run.",
    "",
    "Files:",
    "",
    "- `drawing.scad`: editable OpenSCAD source and the primary CAD artifact.",
    "- `drawing.parameters.json`: editable parameter metadata.",
    "- `exports/preview.stl`: ASCII STL preview model for workspace 3D viewing.",
    "",
    "Brief:",
    "",
    userText.trim() || "(empty)",
    "",
    "Note: `exports/preview.stl` is a preview draft, not an OpenSCAD export.",
    "",
  ].join("\n");
}

export async function ensureIndustrialDrawingFallback(input: {
  cwd: string;
  userText: string;
}): Promise<IndustrialDrawingFallbackResult> {
  const rootDrawing = join(input.cwd, "drawing.scad");
  const targetDir =
    await pathExists(rootDrawing)
      ? join(input.cwd, `fallback-${nowStamp()}`)
      : input.cwd;
  const exportsDir = join(targetDir, "exports");
  await mkdir(exportsDir, { recursive: true });

  const files = [
    ["drawing.scad", buildScad(input.userText)],
    ["drawing.parameters.json", buildParameters(input.userText, relative(input.cwd, targetDir) || ".")],
    ["README.md", buildReadme(input.userText)],
    ["exports/preview.stl", buildPreviewStl()],
  ] as const;

  for (const [relPath, content] of files) {
    await writeFile(join(targetDir, relPath), content, "utf8");
  }

  return {
    relativePaths: files.map(([relPath]) =>
      relative(input.cwd, join(targetDir, relPath)).replace(/\\/g, "/"),
    ),
  };
}

export async function ensureIndustrialDrawingPreviewFallback(input: {
  cwd: string;
  cadSourcePaths: string[];
}): Promise<IndustrialDrawingPreviewFallbackResult | null> {
  const scad = await firstExistingScad(input);
  if (!scad) return null;

  const scadDir = dirname(scad.absPath);
  const exportsDir = join(scadDir, "exports");
  const previewPath = join(exportsDir, "preview.stl");
  if (await pathExists(previewPath)) {
    return {
      sourceScadPath: scad.relPath,
      relativePaths: [
        relative(input.cwd, previewPath).replace(/\\/g, "/"),
      ],
    };
  }

  const source = await readFile(scad.absPath, "utf8");
  const parametersJson = await readOptionalUtf8(
    join(scadDir, "drawing.parameters.json"),
  );
  await mkdir(exportsDir, { recursive: true });
  await writeFile(
    previewPath,
    buildPreviewStlFromScad(source, parametersJson),
    "utf8",
  );

  return {
    sourceScadPath: scad.relPath,
    relativePaths: [
      relative(input.cwd, previewPath).replace(/\\/g, "/"),
    ],
  };
}
