"use client";

import { Download, RotateCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  parametersToJson,
  parseScadParameters,
  updateScadParameters,
  type ScadParameter,
} from "@/lib/scad-parameters";

type Props = {
  projectId: string;
  relativePath: string;
  source: string;
  openscadAvailable?: boolean;
  openscadVersion?: string;
  onSaved?: (nextSource: string) => void;
  onRefreshPreview?: () => void;
  onWorkspaceChanged?: () => void;
};

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

type CadExportFormat = "dxf" | "svg" | "pdf" | "stl";

type CadExportItem = {
  format: CadExportFormat;
  path: string;
  status: "generated" | "failed";
  method?: "openscad_projection" | "openscad_export" | "parameter_outline";
  warning?: string;
  error?: string;
};

type CadExportResponse = {
  ok?: boolean;
  items?: CadExportItem[];
  error?: string;
};

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(0, idx) : "";
}

function siblingPath(path: string, name: string): string {
  const dir = dirname(path);
  return dir ? `${dir}/${name}` : name;
}

function groupedParameters(parameters: ScadParameter[]) {
  const groups = new Map<string, ScadParameter[]>();
  for (const parameter of parameters) {
    const group = parameter.group || "Parameters";
    groups.set(group, [...(groups.get(group) ?? []), parameter]);
  }
  return [...groups.entries()];
}

function numericBounds(parameter: ScadParameter): {
  min: number;
  max: number;
  step: number;
} {
  const value = Number(parameter.value);
  const abs = Math.max(1, Math.abs(value));
  return {
    min: parameter.min ?? 0,
    max: parameter.max ?? Math.ceil(abs * 2),
    step: parameter.step ?? (abs >= 20 ? 1 : 0.1),
  };
}

async function writeWorkspaceFile(input: {
  projectId: string;
  path: string;
  content: string;
}): Promise<void> {
  const res = await fetch("/api/workspace/file", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: input.projectId,
      path: input.path,
      content: input.content,
      encoding: "utf8",
    }),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? `write_failed_${res.status}`);
  }
}

async function exportWorkspaceCad(input: {
  projectId: string;
  path: string;
  source: string;
  formats: CadExportFormat[];
}): Promise<CadExportResponse> {
  const res = await fetch("/api/workspace/cad/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: input.projectId,
      path: input.path,
      source: input.source,
      formats: input.formats,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as CadExportResponse;
  if (!res.ok && json.items?.length) {
    return json;
  }
  if (!res.ok || (!json.ok && !json.items?.length)) {
    throw new Error(json.error ?? `cad_export_${res.status}`);
  }
  return json;
}

function exportMessage(item: CadExportItem): string {
  if (item.format === "dxf") {
    if (item.method === "openscad_projection") {
      return `DXF 已由 OpenSCAD 投影导出：${item.path}`;
    }
    return `DXF 已用参数轮廓导出：${item.path}${item.warning ? `（${item.warning}）` : ""}`;
  }
  if (item.format === "svg") {
    return `SVG 已用参数轮廓导出：${item.path}`;
  }
  if (item.format === "pdf") {
    return `PDF 已用参数轮廓导出：${item.path}`;
  }
  if (item.status === "generated") {
    return `STL 已由 OpenSCAD 导出：${item.path}`;
  }
  return `STL 导出失败：${item.error ?? "OpenSCAD Runtime 未就绪"}`;
}

export function ScadParametersPanel({
  projectId,
  relativePath,
  source,
  openscadAvailable,
  openscadVersion,
  onSaved,
  onRefreshPreview,
  onWorkspaceChanged,
}: Props) {
  const parsed = useMemo(() => parseScadParameters(source), [source]);
  const [parameters, setParameters] = useState<ScadParameter[]>(parsed);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  useEffect(() => {
    // The parameter editor mirrors the currently selected SCAD file.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setParameters(parsed);
    setSaveState({ status: "idle" });
  }, [parsed]);

  const dirty = useMemo(
    () =>
      parameters.some((parameter, index) => {
        const original = parsed[index];
        return original?.value !== parameter.value;
      }),
    [parameters, parsed],
  );

  const updateParameter = (name: string, value: ScadParameter["value"]) => {
    setParameters((prev) =>
      prev.map((parameter) =>
        parameter.name === name ? { ...parameter, value } : parameter,
      ),
    );
    setSaveState({ status: "idle" });
  };

  const reset = () => {
    setParameters(parsed);
    setSaveState({ status: "idle" });
  };

  const save = async () => {
    setSaveState({ status: "saving" });
    try {
      const nextSource = updateScadParameters(source, parameters);
      await writeWorkspaceFile({
        projectId,
        path: relativePath,
        content: nextSource,
      });
      await writeWorkspaceFile({
        projectId,
        path: siblingPath(relativePath, "drawing.parameters.json"),
        content: parametersToJson({
          title: relativePath.split("/").slice(-2, -1)[0],
          parameters,
        }),
      });
      onSaved?.(nextSource);
      onRefreshPreview?.();
      onWorkspaceChanged?.();
      setSaveState({ status: "saved", message: "参数已保存，预览已刷新。" });
    } catch (err) {
      setSaveState({
        status: "error",
        message: err instanceof Error ? err.message : "保存失败",
      });
    }
  };

  const exportCad = async (format: CadExportFormat) => {
    setSaveState({ status: "saving" });
    try {
      const nextSource = updateScadParameters(source, parameters);
      const result = await exportWorkspaceCad({
        projectId,
        path: relativePath,
        source: nextSource,
        formats: [format],
      });
      const item = result.items?.find((entry) => entry.format === format);
      if (!item) throw new Error("导出结果缺失");
      onSaved?.(nextSource);
      onRefreshPreview?.();
      onWorkspaceChanged?.();
      setSaveState({
        status: "saved",
        message: exportMessage(item),
      });
    } catch (err) {
      setSaveState({
        status: "error",
        message: err instanceof Error ? err.message : "导出失败",
      });
    }
  };

  if (parameters.length === 0) {
    return (
      <aside className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--fg-tertiary)]">
        未从 SCAD 顶部解析到可编辑参数。
      </aside>
    );
  }

  return (
    <aside className="flex max-h-[520px] min-w-[260px] flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <div>
          <p className="text-xs font-semibold text-[var(--fg)]">参数面板</p>
          <p className="text-[11px] text-[var(--fg-tertiary)]">
            修改尺寸后保存并刷新预览
          </p>
          <p className="mt-1 text-[10px] text-[var(--fg-tertiary)]">
            DXF：
            {openscadAvailable == null
              ? "检测工具链中"
              : openscadAvailable
                ? `OpenSCAD 投影${openscadVersion ? ` · ${openscadVersion}` : ""}`
                : "参数轮廓兜底"}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className="btn-icon"
            onClick={() => void exportCad("dxf")}
            disabled={saveState.status === "saving"}
            title="导出 DXF 俯视轮廓"
          >
            <Download className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="btn-icon text-[10px] font-semibold"
            onClick={() => void exportCad("svg")}
            disabled={saveState.status === "saving"}
            title="导出 SVG 二维轮廓"
          >
            SVG
          </button>
          <button
            type="button"
            className="btn-icon text-[10px] font-semibold"
            onClick={() => void exportCad("pdf")}
            disabled={saveState.status === "saving"}
            title="导出 PDF 二维轮廓"
          >
            PDF
          </button>
          <button
            type="button"
            className="btn-icon text-[10px] font-semibold"
            onClick={() => void exportCad("stl")}
            disabled={saveState.status === "saving" || openscadAvailable === false}
            title="导出 STL 三维模型"
          >
            STL
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={reset}
            disabled={!dirty || saveState.status === "saving"}
            title="重置参数"
          >
            <RotateCw className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={save}
            disabled={!dirty || saveState.status === "saving"}
            title="保存参数"
          >
            <Save className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3">
        {groupedParameters(parameters).map(([group, items]) => (
          <section key={group} className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--fg-tertiary)]">
              {group}
            </p>
            {items.map((parameter) => {
              if (parameter.type === "number") {
                const bounds = numericBounds(parameter);
                return (
                  <label key={parameter.name} className="block space-y-1.5">
                    <span className="flex items-center justify-between gap-2 text-xs text-[var(--fg)]">
                      <span>{parameter.label}</span>
                      <span className="text-[11px] text-[var(--fg-tertiary)]">
                        {parameter.value}
                        {parameter.unit ? ` ${parameter.unit}` : ""}
                      </span>
                    </span>
                    <input
                      type="range"
                      min={bounds.min}
                      max={bounds.max}
                      step={bounds.step}
                      value={Number(parameter.value)}
                      onChange={(event) =>
                        updateParameter(parameter.name, Number(event.target.value))
                      }
                      className="w-full accent-[var(--accent)]"
                    />
                    <input
                      type="number"
                      min={bounds.min}
                      max={bounds.max}
                      step={bounds.step}
                      value={Number(parameter.value)}
                      onChange={(event) =>
                        updateParameter(parameter.name, Number(event.target.value))
                      }
                      className="input h-8 w-full px-2 py-1 text-xs"
                    />
                  </label>
                );
              }

              if (parameter.options?.length) {
                return (
                  <label key={parameter.name} className="block space-y-1.5">
                    <span className="text-xs text-[var(--fg)]">
                      {parameter.label}
                    </span>
                    <select
                      value={String(parameter.value)}
                      onChange={(event) =>
                        updateParameter(parameter.name, event.target.value)
                      }
                      className="input h-8 w-full px-2 py-1 text-xs"
                    >
                      {parameter.options.map((option) => (
                        <option key={String(option.value)} value={String(option.value)}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }

              if (parameter.type === "boolean") {
                return (
                  <label
                    key={parameter.name}
                    className="flex items-center justify-between gap-3 text-xs text-[var(--fg)]"
                  >
                    <span>{parameter.label}</span>
                    <input
                      type="checkbox"
                      checked={parameter.value === true}
                      onChange={(event) =>
                        updateParameter(parameter.name, event.target.checked)
                      }
                    />
                  </label>
                );
              }

              return (
                <label key={parameter.name} className="block space-y-1.5">
                  <span className="text-xs text-[var(--fg)]">
                    {parameter.label}
                  </span>
                  <input
                    type="text"
                    value={String(parameter.value)}
                    onChange={(event) =>
                      updateParameter(parameter.name, event.target.value)
                    }
                    className="input h-8 w-full px-2 py-1 text-xs"
                  />
                </label>
              );
            })}
          </section>
        ))}
      </div>
      {saveState.status !== "idle" && (
        <p
          className={`border-t border-[var(--border)] px-3 py-2 text-[11px] ${
            saveState.status === "error"
              ? "text-[var(--danger)]"
              : "text-[var(--fg-tertiary)]"
          }`}
        >
          {saveState.status === "saving" ? "正在保存参数…" : saveState.message}
        </p>
      )}
    </aside>
  );
}
