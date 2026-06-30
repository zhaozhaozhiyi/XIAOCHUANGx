import type { ScadParameter } from "@/lib/scad-parameters";

type DxfPair = {
  code: string;
  value: string;
};

type Point = {
  x: number;
  y: number;
};

type Extents = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type OutlineCircle = {
  center: Point;
  radius: number;
};

type ParameterOutlineGeometry = {
  length: number;
  width: number;
  holes: OutlineCircle[];
};

const LENGTH_NAMES = [
  "base_length",
  "base_l",
  "base_w",
  "plate_length",
  "plate_l",
  "length",
  "flange_length",
  "bracket_length",
  "w",
];

const WIDTH_NAMES = [
  "base_width",
  "base_d",
  "base_depth",
  "plate_width",
  "plate_w",
  "width",
  "depth",
  "flange_width",
  "bracket_width",
  "d",
];

const HOLE_DIAMETER_NAMES = [
  "hole_diameter",
  "hole_d",
  "mount_hole_diameter",
  "mount_hole_d",
  "mounting_hole_diameter",
  "mounting_hole_d",
  "bolt_hole_diameter",
  "bolt_hole_d",
];

const HOLE_MARGIN_NAMES = [
  "hole_edge",
  "hole_margin",
  "mount_hole_edge",
  "mount_hole_margin",
  "mounting_hole_edge",
  "mounting_hole_margin",
  "edge_offset",
  "hole_offset",
  "margin",
];

function numberParam(parameters: ScadParameter[], names: string[]): number | null {
  const byName = new Map(
    parameters.map((parameter) => [parameter.name.toLowerCase(), parameter]),
  );
  for (const name of names) {
    const parameter = byName.get(name.toLowerCase());
    if (parameter?.type !== "number") continue;
    const value = Number(parameter.value);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function formatCoord(value: number): string {
  if (!Number.isFinite(value)) return "0.000000";
  return value.toFixed(6);
}

function serializePairs(pairs: DxfPair[]): string {
  return `${pairs.map(({ code, value }) => `${code}\n${value}`).join("\n")}\n`;
}

function line(start: Point, end: Point, layer = "OUTLINE"): DxfPair[] {
  return [
    { code: "0", value: "LINE" },
    { code: "8", value: layer },
    { code: "10", value: formatCoord(start.x) },
    { code: "20", value: formatCoord(start.y) },
    { code: "30", value: "0.0" },
    { code: "11", value: formatCoord(end.x) },
    { code: "21", value: formatCoord(end.y) },
    { code: "31", value: "0.0" },
  ];
}

function circle(center: Point, radius: number, layer = "HOLES"): DxfPair[] {
  return [
    { code: "0", value: "CIRCLE" },
    { code: "8", value: layer },
    { code: "10", value: formatCoord(center.x) },
    { code: "20", value: formatCoord(center.y) },
    { code: "30", value: "0.0" },
    { code: "40", value: formatCoord(radius) },
  ];
}

function buildHeader(extents: Extents): DxfPair[] {
  return [
    { code: "0", value: "SECTION" },
    { code: "2", value: "HEADER" },
    { code: "9", value: "$ACADVER" },
    { code: "1", value: "AC1009" },
    { code: "9", value: "$INSUNITS" },
    { code: "70", value: "4" },
    { code: "9", value: "$EXTMIN" },
    { code: "10", value: formatCoord(extents.minX) },
    { code: "20", value: formatCoord(extents.minY) },
    { code: "30", value: "0.0" },
    { code: "9", value: "$EXTMAX" },
    { code: "10", value: formatCoord(extents.maxX) },
    { code: "20", value: formatCoord(extents.maxY) },
    { code: "30", value: "0.0" },
    { code: "0", value: "ENDSEC" },
  ];
}

function buildTables(): DxfPair[] {
  return [
    { code: "0", value: "SECTION" },
    { code: "2", value: "TABLES" },
    { code: "0", value: "TABLE" },
    { code: "2", value: "LTYPE" },
    { code: "70", value: "1" },
    { code: "0", value: "LTYPE" },
    { code: "2", value: "CONTINUOUS" },
    { code: "70", value: "0" },
    { code: "3", value: "Solid line" },
    { code: "72", value: "65" },
    { code: "73", value: "0" },
    { code: "40", value: "0.0" },
    { code: "0", value: "ENDTAB" },
    { code: "0", value: "TABLE" },
    { code: "2", value: "LAYER" },
    { code: "70", value: "3" },
    { code: "0", value: "LAYER" },
    { code: "2", value: "0" },
    { code: "70", value: "0" },
    { code: "62", value: "7" },
    { code: "6", value: "CONTINUOUS" },
    { code: "0", value: "LAYER" },
    { code: "2", value: "OUTLINE" },
    { code: "70", value: "0" },
    { code: "62", value: "7" },
    { code: "6", value: "CONTINUOUS" },
    { code: "0", value: "LAYER" },
    { code: "2", value: "HOLES" },
    { code: "70", value: "0" },
    { code: "62", value: "1" },
    { code: "6", value: "CONTINUOUS" },
    { code: "0", value: "ENDTAB" },
    { code: "0", value: "TABLE" },
    { code: "2", value: "STYLE" },
    { code: "70", value: "1" },
    { code: "0", value: "STYLE" },
    { code: "2", value: "STANDARD" },
    { code: "70", value: "0" },
    { code: "40", value: "0.0" },
    { code: "41", value: "1.0" },
    { code: "50", value: "0.0" },
    { code: "71", value: "0" },
    { code: "42", value: "2.5" },
    { code: "3", value: "txt" },
    { code: "4", value: "" },
    { code: "0", value: "ENDTAB" },
    { code: "0", value: "ENDSEC" },
  ];
}

function buildR12Dxf(entityPairs: DxfPair[], extents: Extents): string {
  const pairs: DxfPair[] = [
    ...buildHeader(extents),
    ...buildTables(),
    { code: "0", value: "SECTION" },
    { code: "2", value: "BLOCKS" },
    { code: "0", value: "ENDSEC" },
    { code: "0", value: "SECTION" },
    { code: "2", value: "ENTITIES" },
    ...entityPairs,
    { code: "0", value: "ENDSEC" },
    { code: "0", value: "EOF" },
  ];
  return serializePairs(pairs);
}

function toDxfPairs(dxf: string): DxfPair[] {
  const lines = dxf.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const pairs: DxfPair[] = [];
  for (let index = 0; index < lines.length - 1; index += 2) {
    pairs.push({
      code: lines[index]?.trim() ?? "",
      value: lines[index + 1]?.trim() ?? "",
    });
  }
  return pairs;
}

function findEntitiesStart(pairs: DxfPair[]): number {
  for (let index = 0; index < pairs.length - 1; index += 1) {
    if (
      pairs[index]?.code === "0" &&
      pairs[index]?.value === "SECTION" &&
      pairs[index + 1]?.code === "2" &&
      pairs[index + 1]?.value === "ENTITIES"
    ) {
      return index + 2;
    }
  }
  return -1;
}

function isCoordinateCode(code: string): boolean {
  const numeric = Number(code);
  return (
    Number.isFinite(numeric) &&
    ((numeric >= 10 && numeric <= 19) ||
      (numeric >= 20 && numeric <= 29) ||
      (numeric >= 30 && numeric <= 39))
  );
}

function normalizePair(pair: DxfPair): DxfPair {
  if (!isCoordinateCode(pair.code)) return pair;
  const numeric = Number(pair.value);
  if (!Number.isFinite(numeric)) return pair;
  return { ...pair, value: formatCoord(numeric) };
}

function convertLwPolyline(
  pairs: DxfPair[],
  startIndex: number,
): { pairs: DxfPair[]; nextIndex: number } {
  let layer = "0";
  let closed = false;
  let pendingX: string | null = null;
  const vertices: Point[] = [];
  let nextIndex = pairs.length;

  for (let index = startIndex + 1; index < pairs.length; index += 1) {
    const pair = pairs[index];
    if (!pair) continue;
    if (pair.code === "0") {
      nextIndex = index;
      break;
    }
    if (pair.code === "8") layer = pair.value || "0";
    if (pair.code === "70") closed = (Number(pair.value) & 1) === 1;
    if (pair.code === "10") pendingX = pair.value;
    if (pair.code === "20" && pendingX != null) {
      const x = Number(pendingX);
      const y = Number(pair.value);
      if (Number.isFinite(x) && Number.isFinite(y)) vertices.push({ x, y });
      pendingX = null;
    }
  }

  const segmentCount = closed ? vertices.length : vertices.length - 1;
  const output: DxfPair[] = [];
  for (let index = 0; index < segmentCount; index += 1) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    if (!start || !end) continue;
    output.push(...line(start, end, layer));
  }

  return { pairs: output, nextIndex };
}

function extractEntityPairs(pairs: DxfPair[]): DxfPair[] {
  const start = findEntitiesStart(pairs);
  if (start < 0) return [];

  const output: DxfPair[] = [];
  for (let index = start; index < pairs.length; index += 1) {
    const pair = pairs[index];
    if (!pair) continue;
    if (pair.code === "0" && (pair.value === "ENDSEC" || pair.value === "EOF")) {
      break;
    }
    if (pair.code === "0" && pair.value === "LWPOLYLINE") {
      const converted = convertLwPolyline(pairs, index);
      output.push(...converted.pairs);
      index = converted.nextIndex - 1;
      continue;
    }
    output.push(normalizePair(pair));
  }
  return output;
}

function computeExtents(entityPairs: DxfPair[]): Extents {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pair of entityPairs) {
    const code = Number(pair.code);
    const value = Number(pair.value);
    if (!Number.isFinite(code) || !Number.isFinite(value)) continue;
    if (code >= 10 && code <= 19) {
      minX = Math.min(minX, value);
      maxX = Math.max(maxX, value);
    }
    if (code >= 20 && code <= 29) {
      minY = Math.min(minY, value);
      maxY = Math.max(maxY, value);
    }
  }

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  return { minX, minY, maxX, maxY };
}

function splitOpenScadImports(source: string): {
  imports: string[];
  body: string;
} {
  const normalized = source.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const originalLines = normalized.split("\n");
  const scanLines = normalized
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ""))
    .replace(/\/\/[^\n]*/g, "")
    .split("\n");
  const imports: string[] = [];
  const body: string[] = [];
  const importLine = /^[ \t]*(?:use|include)\s*<[^>]+>\s*;?[ \t]*$/;

  originalLines.forEach((lineText, index) => {
    if (importLine.test(scanLines[index] ?? "")) {
      imports.push(lineText.trim());
    } else {
      body.push(lineText);
    }
  });

  return { imports, body: body.join("\n") };
}

export function createDxfProjectionSource(source: string): string {
  const { imports, body } = splitOpenScadImports(source);
  const wrapped = `module __jlc_projection_source__() {\n${body.trim()}\n}`;
  return [
    ...imports,
    wrapped,
    "projection(cut = false) __jlc_projection_source__();",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function normalizeOpenScadDxf(dxf: string): string {
  const entityPairs = extractEntityPairs(toDxfPairs(dxf));
  return buildR12Dxf(entityPairs, computeExtents(entityPairs));
}

function rectangleEntities(length: number, width: number): DxfPair[] {
  const a = { x: 0, y: 0 };
  const b = { x: length, y: 0 };
  const c = { x: length, y: width };
  const d = { x: 0, y: width };
  return [...line(a, b), ...line(b, c), ...line(c, d), ...line(d, a)];
}

function outlineHoles(input: {
  length: number;
  width: number;
  diameter: number;
  margin: number;
}): OutlineCircle[] {
  const { length, width, diameter, margin } = input;
  const radius = diameter / 2;
  if (
    margin <= radius ||
    margin >= length / 2 ||
    margin >= width / 2 ||
    radius <= 0
  ) {
    return [];
  }

  return [
    { center: { x: margin, y: margin }, radius },
    { center: { x: length - margin, y: margin }, radius },
    { center: { x: length - margin, y: width - margin }, radius },
    { center: { x: margin, y: width - margin }, radius },
  ];
}

function parameterOutlineGeometry(
  parameters: ScadParameter[],
): ParameterOutlineGeometry {
  const length = numberParam(parameters, LENGTH_NAMES) ?? 120;
  const width = numberParam(parameters, WIDTH_NAMES) ?? 80;
  const holeDiameter = numberParam(parameters, HOLE_DIAMETER_NAMES);
  const holeMargin = numberParam(parameters, HOLE_MARGIN_NAMES);
  return {
    length,
    width,
    holes:
      holeDiameter && holeMargin
        ? outlineHoles({
            length,
            width,
            diameter: holeDiameter,
            margin: holeMargin,
          })
        : [],
  };
}

function parameterOutlineDxfEntities(
  geometry: ParameterOutlineGeometry,
): DxfPair[] {
  const { length, width, holes } = geometry;
  return [
    ...rectangleEntities(length, width),
    ...holes.flatMap((hole) => circle(hole.center, hole.radius)),
  ];
}

export function buildDxfFromScadParameters(parameters: ScadParameter[]): string {
  const geometry = parameterOutlineGeometry(parameters);
  const entities = [
    ...parameterOutlineDxfEntities(geometry),
  ];

  return buildR12Dxf(entities, {
    minX: 0,
    minY: 0,
    maxX: geometry.length,
    maxY: geometry.width,
  });
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildSvgFromScadParameters(parameters: ScadParameter[]): string {
  const geometry = parameterOutlineGeometry(parameters);
  const margin = Math.max(10, Math.max(geometry.length, geometry.width) * 0.08);
  const viewWidth = geometry.length + margin * 2;
  const viewHeight = geometry.width + margin * 2;
  const label = `${formatCoord(geometry.length)} x ${formatCoord(geometry.width)} mm`;
  const holes = geometry.holes
    .map(
      (hole) =>
        `<circle class="hole" cx="${formatCoord(margin + hole.center.x)}" cy="${formatCoord(margin + geometry.width - hole.center.y)}" r="${formatCoord(hole.radius)}" />`,
    )
    .join("\n    ");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${formatCoord(viewWidth)}mm" height="${formatCoord(viewHeight)}mm" viewBox="0 0 ${formatCoord(viewWidth)} ${formatCoord(viewHeight)}" role="img" aria-label="${xmlEscape(label)}">`,
    `  <style>`,
    `    .outline { fill: none; stroke: #111827; stroke-width: 0.6; vector-effect: non-scaling-stroke; }`,
    `    .hole { fill: none; stroke: #dc2626; stroke-width: 0.45; vector-effect: non-scaling-stroke; }`,
    `    .dim { fill: #6b7280; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 4px; }`,
    `  </style>`,
    `  <rect class="outline" x="${formatCoord(margin)}" y="${formatCoord(margin)}" width="${formatCoord(geometry.length)}" height="${formatCoord(geometry.width)}" />`,
    holes ? `  ${holes}` : "",
    `  <text class="dim" x="${formatCoord(margin)}" y="${formatCoord(viewHeight - margin / 2)}">${xmlEscape(label)}</text>`,
    `</svg>`,
    "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function pdfEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function pdfNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3).replace(/\.?0+$/, "") : "0";
}

export function buildPdfFromScadParameters(parameters: ScadParameter[]): string {
  const geometry = parameterOutlineGeometry(parameters);
  const margin = 36;
  const scale = Math.min(
    6,
    Math.max(
      1,
      Math.min(
        (595.28 - margin * 2) / Math.max(1, geometry.length),
        (841.89 - margin * 2) / Math.max(1, geometry.width),
      ),
    ),
  );
  const pageWidth = Math.max(180, geometry.length * scale + margin * 2);
  const pageHeight = Math.max(180, geometry.width * scale + margin * 2 + 24);
  const x = margin;
  const y = margin + 24;
  const width = geometry.length * scale;
  const height = geometry.width * scale;
  const drawing = [
    "0.2 w",
    "0 0 0 RG",
    `${pdfNumber(x)} ${pdfNumber(y)} ${pdfNumber(width)} ${pdfNumber(height)} re S`,
    "1 0 0 RG",
    ...geometry.holes.map((hole) => {
      const cx = x + hole.center.x * scale;
      const cy = y + hole.center.y * scale;
      const r = hole.radius * scale;
      const c = r * 0.5522847498;
      return [
        `${pdfNumber(cx + r)} ${pdfNumber(cy)} m`,
        `${pdfNumber(cx + r)} ${pdfNumber(cy + c)} ${pdfNumber(cx + c)} ${pdfNumber(cy + r)} ${pdfNumber(cx)} ${pdfNumber(cy + r)} c`,
        `${pdfNumber(cx - c)} ${pdfNumber(cy + r)} ${pdfNumber(cx - r)} ${pdfNumber(cy + c)} ${pdfNumber(cx - r)} ${pdfNumber(cy)} c`,
        `${pdfNumber(cx - r)} ${pdfNumber(cy - c)} ${pdfNumber(cx - c)} ${pdfNumber(cy - r)} ${pdfNumber(cx)} ${pdfNumber(cy - r)} c`,
        `${pdfNumber(cx + c)} ${pdfNumber(cy - r)} ${pdfNumber(cx + r)} ${pdfNumber(cy - c)} ${pdfNumber(cx + r)} ${pdfNumber(cy)} c S`,
      ].join("\n");
    }),
    "0.35 0.35 0.35 rg",
    "BT /F1 10 Tf",
    `${pdfNumber(margin)} ${pdfNumber(pageHeight - margin)} Td`,
    `(Parameter outline: ${pdfEscape(`${formatCoord(geometry.length)} x ${formatCoord(geometry.width)} mm`)}) Tj`,
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfNumber(pageWidth)} ${pdfNumber(pageHeight)}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${Buffer.byteLength(drawing, "utf8")} >>\nstream\n${drawing}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const chunks = ["%PDF-1.4\n"];
  const offsets: number[] = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(chunks.join(""), "utf8"));
    chunks.push(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`);
  }
  const xrefOffset = Buffer.byteLength(chunks.join(""), "utf8");
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push("0000000000 65535 f \n");
  for (const offset of offsets.slice(1)) {
    chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  }
  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );
  return chunks.join("");
}
