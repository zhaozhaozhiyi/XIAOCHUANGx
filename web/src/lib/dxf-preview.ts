type DxfPair = {
  code: string;
  value: string;
};

type Point = {
  x: number;
  y: number;
};

export type DxfPreviewEntity =
  | {
      type: "line";
      layer: string;
      start: Point;
      end: Point;
    }
  | {
      type: "circle";
      layer: string;
      center: Point;
      radius: number;
    }
  | {
      type: "arc";
      layer: string;
      center: Point;
      radius: number;
      startAngle: number;
      endAngle: number;
    };

export type DxfPreviewBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type DxfPreviewModel = {
  entities: DxfPreviewEntity[];
  bounds: DxfPreviewBounds;
  layers: string[];
  stats: DxfPreviewStats;
};

export type DxfPreviewStats = {
  lineCount: number;
  circleCount: number;
  arcCount: number;
  totalCutLength: number;
  uniqueCircleDiameters: number[];
};

function toPairs(dxf: string): DxfPair[] {
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

function entityChunks(pairs: DxfPair[]): DxfPair[][] {
  const chunks: DxfPair[][] = [];
  let inEntities = false;
  let current: DxfPair[] = [];

  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index];
    const next = pairs[index + 1];
    if (!pair) continue;

    if (
      pair.code === "0" &&
      pair.value === "SECTION" &&
      next?.code === "2" &&
      next.value === "ENTITIES"
    ) {
      inEntities = true;
      index += 1;
      continue;
    }

    if (!inEntities) continue;
    if (pair.code === "0" && pair.value === "ENDSEC") break;

    if (pair.code === "0") {
      if (current.length) chunks.push(current);
      current = [pair];
    } else {
      current.push(pair);
    }
  }

  if (current.length) chunks.push(current);
  return chunks;
}

function numberValue(
  pairs: DxfPair[],
  code: string,
  fallback = 0,
): number {
  const raw = pairs.find((pair) => pair.code === code)?.value;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function stringValue(
  pairs: DxfPair[],
  code: string,
  fallback = "0",
): string {
  return pairs.find((pair) => pair.code === code)?.value || fallback;
}

function parseLine(pairs: DxfPair[]): DxfPreviewEntity {
  return {
    type: "line",
    layer: stringValue(pairs, "8"),
    start: { x: numberValue(pairs, "10"), y: numberValue(pairs, "20") },
    end: { x: numberValue(pairs, "11"), y: numberValue(pairs, "21") },
  };
}

function parseCircle(pairs: DxfPair[]): DxfPreviewEntity {
  return {
    type: "circle",
    layer: stringValue(pairs, "8"),
    center: { x: numberValue(pairs, "10"), y: numberValue(pairs, "20") },
    radius: Math.max(0, numberValue(pairs, "40")),
  };
}

function parseArc(pairs: DxfPair[]): DxfPreviewEntity {
  return {
    type: "arc",
    layer: stringValue(pairs, "8"),
    center: { x: numberValue(pairs, "10"), y: numberValue(pairs, "20") },
    radius: Math.max(0, numberValue(pairs, "40")),
    startAngle: numberValue(pairs, "50"),
    endAngle: numberValue(pairs, "51"),
  };
}

function parseLightweightPolyline(pairs: DxfPair[]): DxfPreviewEntity[] {
  const layer = stringValue(pairs, "8");
  const closed = (numberValue(pairs, "70") & 1) === 1;
  const vertices: Point[] = [];
  let pendingX: number | null = null;

  for (const pair of pairs) {
    if (pair.code === "10") {
      const x = Number(pair.value);
      pendingX = Number.isFinite(x) ? x : null;
    }
    if (pair.code === "20" && pendingX != null) {
      const y = Number(pair.value);
      if (Number.isFinite(y)) vertices.push({ x: pendingX, y });
      pendingX = null;
    }
  }

  const segmentCount = closed ? vertices.length : vertices.length - 1;
  const output: DxfPreviewEntity[] = [];
  for (let index = 0; index < segmentCount; index += 1) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    if (!start || !end) continue;
    output.push({ type: "line", layer, start, end });
  }
  return output;
}

function addPoint(bounds: DxfPreviewBounds, point: Point): void {
  bounds.minX = Math.min(bounds.minX, point.x);
  bounds.minY = Math.min(bounds.minY, point.y);
  bounds.maxX = Math.max(bounds.maxX, point.x);
  bounds.maxY = Math.max(bounds.maxY, point.y);
}

function computeBounds(entities: DxfPreviewEntity[]): DxfPreviewBounds {
  const bounds: DxfPreviewBounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };

  for (const entity of entities) {
    if (entity.type === "line") {
      addPoint(bounds, entity.start);
      addPoint(bounds, entity.end);
    } else {
      addPoint(bounds, {
        x: entity.center.x - entity.radius,
        y: entity.center.y - entity.radius,
      });
      addPoint(bounds, {
        x: entity.center.x + entity.radius,
        y: entity.center.y + entity.radius,
      });
    }
  }

  if (
    !Number.isFinite(bounds.minX) ||
    !Number.isFinite(bounds.minY) ||
    !Number.isFinite(bounds.maxX) ||
    !Number.isFinite(bounds.maxY)
  ) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  }
  if (bounds.minX === bounds.maxX) bounds.maxX += 1;
  if (bounds.minY === bounds.maxY) bounds.maxY += 1;
  return bounds;
}

function lineLength(entity: Extract<DxfPreviewEntity, { type: "line" }>): number {
  return Math.hypot(entity.end.x - entity.start.x, entity.end.y - entity.start.y);
}

function arcSweepDegrees(
  entity: Extract<DxfPreviewEntity, { type: "arc" }>,
): number {
  const raw = entity.endAngle - entity.startAngle;
  return raw >= 0 ? raw : raw + 360;
}

function entityCutLength(entity: DxfPreviewEntity): number {
  if (entity.type === "line") return lineLength(entity);
  if (entity.type === "circle") return 2 * Math.PI * entity.radius;
  return (Math.PI * entity.radius * arcSweepDegrees(entity)) / 180;
}

function rounded(value: number): number {
  return Number(value.toFixed(3));
}

function computeStats(entities: DxfPreviewEntity[]): DxfPreviewStats {
  const circles = entities.filter((entity) => entity.type === "circle");
  return {
    lineCount: entities.filter((entity) => entity.type === "line").length,
    circleCount: circles.length,
    arcCount: entities.filter((entity) => entity.type === "arc").length,
    totalCutLength: entities.reduce(
      (sum, entity) => sum + entityCutLength(entity),
      0,
    ),
    uniqueCircleDiameters: [
      ...new Set(circles.map((entity) => rounded(entity.radius * 2))),
    ].sort((a, b) => a - b),
  };
}

export function parseDxfPreview(dxf: string): DxfPreviewModel {
  const entities: DxfPreviewEntity[] = [];

  for (const chunk of entityChunks(toPairs(dxf))) {
    const entityType = chunk[0]?.value;
    if (entityType === "LINE") {
      entities.push(parseLine(chunk));
    } else if (entityType === "CIRCLE") {
      entities.push(parseCircle(chunk));
    } else if (entityType === "ARC") {
      entities.push(parseArc(chunk));
    } else if (entityType === "LWPOLYLINE") {
      entities.push(...parseLightweightPolyline(chunk));
    }
  }

  return {
    entities,
    bounds: computeBounds(entities),
    layers: [...new Set(entities.map((entity) => entity.layer))].sort(),
    stats: computeStats(entities),
  };
}
