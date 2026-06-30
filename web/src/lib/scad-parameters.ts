export type ScadParameterType = "number" | "string" | "boolean";

export type ScadParameterOption = {
  label: string;
  value: string | number;
};

export type ScadParameter = {
  name: string;
  label: string;
  group: string;
  type: ScadParameterType;
  value: string | number | boolean;
  defaultValue: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: ScadParameterOption[];
  description?: string;
  unit?: string;
};

function titleCaseName(name: string): string {
  if (name === "$fn") return "Resolution";
  return name
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(" ");
}

function parseLiteral(raw: string): {
  type: ScadParameterType;
  value: string | number | boolean;
} | null {
  const trimmed = raw.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return { type: "number", value: Number(trimmed) };
  }
  if (trimmed === "true" || trimmed === "false") {
    return { type: "boolean", value: trimmed === "true" };
  }
  const quoted = trimmed.match(/^"(.*)"$/);
  if (quoted) {
    return { type: "string", value: quoted[1] ?? "" };
  }
  return null;
}

function parseHint(
  rawComment: string | undefined,
  type: ScadParameterType,
): Pick<ScadParameter, "min" | "max" | "step" | "options"> {
  const raw = rawComment?.replace(/^\/\/\s*/, "").trim();
  if (!raw) return {};
  const bracket = raw.match(/^\[([^\]]+)\]$/);
  const inner = bracket?.[1]?.trim();
  if (!inner) return {};

  if (inner.includes(",")) {
    return {
      options: inner
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => {
          const [valueRaw, labelRaw] = item.split(":");
          const valueText = valueRaw?.trim() ?? "";
          const value =
            type === "number" && Number.isFinite(Number(valueText))
              ? Number(valueText)
              : valueText.replace(/^"|"$/g, "");
          return {
            value,
            label: labelRaw?.trim() || String(value),
          };
        }),
    };
  }

  if (/^-?\d+(?:\.\d+)?(?::-?\d+(?:\.\d+)?){1,2}$/.test(inner)) {
    const parts = inner.split(":").map(Number);
    if (parts.length === 2) {
      return { min: parts[0], max: parts[1] };
    }
    if (parts.length === 3) {
      return { min: parts[0], step: parts[1], max: parts[2] };
    }
  }

  return {};
}

function parseLineComment(rawComment: string | undefined): string | undefined {
  const raw = rawComment?.replace(/^\/\/\s*/, "").trim();
  if (!raw || /^\[[^\]]+\]$/.test(raw)) return undefined;
  return raw;
}

function findDescription(lines: string[], lineIndex: number): string | undefined {
  const previous = lines[lineIndex - 1]?.trim();
  if (!previous?.startsWith("//")) return undefined;
  const description = previous.replace(/^\/\/\s*/, "").trim();
  return description || undefined;
}

export function parseScadParameters(source: string): ScadParameter[] {
  const header = source.split(/^(?:module|function)\s+/m)[0] ?? source;
  const lines = header.replace(/\r\n/g, "\n").split("\n");
  const params: ScadParameter[] = [];
  let group = "";

  lines.forEach((line, index) => {
    const groupMatch = line.match(/^\s*\/\*\s*\[([^\]]+)\]\s*\*\/\s*$/);
    if (groupMatch) {
      group = groupMatch[1]?.trim() ?? "";
      return;
    }

    const match = line.match(
      /^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*([^;]+);\s*(\/\/.*)?$/,
    );
    if (!match) return;
    const name = match[1] ?? "";
    const parsed = parseLiteral(match[2] ?? "");
    if (!name || !parsed) return;

    params.push({
      name,
      label: parseLineComment(match[3]) ?? titleCaseName(name),
      group,
      type: parsed.type,
      value: parsed.value,
      defaultValue: parsed.value,
      description: findDescription(lines, index) ?? parseLineComment(match[3]),
      unit: parsed.type === "number" && /height|width|length|depth|thickness|diameter|radius|offset|spacing|margin|distance|gap|hole/i.test(name)
        ? "mm"
        : undefined,
      ...parseHint(match[3], parsed.type),
    });
  });

  return params;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatValue(parameter: ScadParameter, value: ScadParameter["value"]): string {
  if (parameter.type === "string") {
    return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  if (parameter.type === "boolean") {
    return value === true ? "true" : "false";
  }
  return String(Number(value));
}

export function updateScadParameter(
  source: string,
  parameter: ScadParameter,
): string {
  const pattern = new RegExp(
    `^(\\s*${escapeRegExp(parameter.name)}\\s*=\\s*)[^;]+;(\\s*//[^\\n]*)?`,
    "m",
  );
  return source.replace(
    pattern,
    `$1${formatValue(parameter, parameter.value)};$2`,
  );
}

export function updateScadParameters(
  source: string,
  parameters: ScadParameter[],
): string {
  return parameters.reduce(
    (next, parameter) => updateScadParameter(next, parameter),
    source,
  );
}

export function parametersToJson(input: {
  title?: string;
  parameters: ScadParameter[];
  dxfStatus?: "on_demand" | "generated";
  dxfMethod?: "openscad_projection" | "parameter_outline";
  dxfWarning?: string;
}): string {
  return `${JSON.stringify(
    {
      engine: "openscad",
      title: input.title ?? "industrial drawing",
      parameters: input.parameters.map((parameter) => ({
        name: parameter.name,
        label: parameter.label,
        value: parameter.value,
        unit: parameter.unit,
        min: parameter.min,
        max: parameter.max,
        step: parameter.step,
        options: parameter.options,
        group: parameter.group || undefined,
        type: parameter.type,
      })),
      exports: [
        { format: "scad", path: "drawing.scad", status: "generated" },
        {
          format: "stl",
          path: "exports/preview.stl",
          status: "preview_generated",
        },
        {
          format: "dxf",
          path: "exports/drawing.dxf",
          status: input.dxfStatus ?? "on_demand",
          method: input.dxfMethod,
          warning: input.dxfWarning,
        },
      ],
      updatedAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`;
}
