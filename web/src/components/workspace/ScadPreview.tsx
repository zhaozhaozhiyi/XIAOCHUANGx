"use client";

import { RotateCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { StlPreview } from "./StlPreview";
import { SvgPreview } from "./SvgPreview";
import { ScadParametersPanel } from "./ScadParametersPanel";
import { compileScadWithOpenScadWasm } from "@/lib/openscad-wasm-preview";
import { buildSvgFromScadParameters } from "@/lib/scad-dxf-export";
import { parseScadParameters } from "@/lib/scad-parameters";

type Props = {
  projectId: string;
  relativePath: string;
  fileName: string;
  source: string;
  onSourceSaved?: (nextSource: string) => void;
  onWorkspaceChanged?: () => void;
};

type CompileState =
  | { status: "loading"; message: string }
  | {
      status: "ready";
      base64: string;
      source: "openscad" | "openscad_wasm" | "preview_stl";
      warning?: string;
    }
  | {
      status: "ready_svg";
      svg: string;
      source: "parameter_svg";
      warning?: string;
    }
  | { status: "error"; message: string; detail?: string };

type OpenScadLicenseNotices = {
  available?: boolean;
  reason?: string;
  detail?: string;
};

type ToolchainState =
  | { status: "loading" }
  | {
      status: "ready";
      openscad: {
        available: boolean;
        source?: "env" | "bundled" | "dev_path";
        version?: string;
        reason?: string;
        detail?: string;
        licenseNotices?: OpenScadLicenseNotices;
      };
      capabilities?: {
        scadToStl?: boolean;
        scadToDxfProjection?: boolean;
        previewStlFallback?: boolean;
        parameterOutlineDxfFallback?: boolean;
      };
    }
  | { status: "error"; message: string };

type ToolchainResponse = {
  openscad?: {
    available?: boolean;
    source?: "env" | "bundled" | "dev_path";
    version?: string;
    reason?: string;
    detail?: string;
    licenseNotices?: OpenScadLicenseNotices;
  };
  capabilities?: {
    scadToStl?: boolean;
    scadToDxfProjection?: boolean;
    previewStlFallback?: boolean;
    parameterOutlineDxfFallback?: boolean;
  };
};

function compileErrorMessage(error?: string): string {
  if (error === "openscad_unavailable") {
    return "产品内置 OpenSCAD Runtime 尚未就绪，暂时无法编译 3D 预览。";
  }
  if (error === "openscad_timeout") return "OpenSCAD 编译超时。";
  if (error === "openscad_compile_failed") return "OpenSCAD 编译失败。";
  if (error === "workspace_not_ready") return "工作区尚未就绪。";
  return "无法生成 SCAD 预览。";
}

function licenseNoticeLabel(licenseNotices?: OpenScadLicenseNotices): string {
  if (!licenseNotices) return "";
  if (licenseNotices.available) return " · 许可证材料已就绪";
  if (licenseNotices.reason === "dev_path_not_packaged") {
    return " · PATH 仅用于开发调试";
  }
  if (licenseNotices.reason === "runtime_missing") return "";
  return " · 许可证材料待补齐";
}

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(0, idx) : "";
}

function previewStlPath(path: string): string {
  const dir = dirname(path);
  return dir ? `${dir}/exports/preview.stl` : "exports/preview.stl";
}

async function fetchPreviewStlFallback(input: {
  projectId: string;
  relativePath: string;
}): Promise<string | null> {
  const q = new URLSearchParams({
    projectId: input.projectId,
    path: previewStlPath(input.relativePath),
  });
  const res = await fetch(`/api/workspace/file?${q}`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as {
    content?: string;
    encoding?: string;
  } | null;
  if (json?.encoding !== "base64" || !json.content) return null;
  return json.content;
}

function buildParameterSvgFallback(source: string): string | null {
  const parameters = parseScadParameters(source);
  if (parameters.length === 0) return null;
  return buildSvgFromScadParameters(parameters);
}

export function ScadPreview({
  projectId,
  relativePath,
  fileName,
  source,
  onSourceSaved,
  onWorkspaceChanged,
}: Props) {
  const [version, setVersion] = useState(0);
  const [draftSource, setDraftSource] = useState(source);
  const [state, setState] = useState<CompileState>({
    status: "loading",
    message: "正在编译 OpenSCAD…",
  });
  const [toolchain, setToolchain] = useState<ToolchainState>({
    status: "loading",
  });

  useEffect(() => {
    // Keep the preview draft aligned when the selected workspace file changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftSource(source);
  }, [source]);

  const retry = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/workspace/cad/toolchain", { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as
          | ToolchainResponse
          | null;
        if (cancelled) return;
        if (!res.ok || !json?.openscad) {
          setToolchain({ status: "error", message: "无法读取 CAD 工具链状态" });
          return;
        }
        setToolchain({
          status: "ready",
          openscad: {
            available: json.openscad.available === true,
            source: json.openscad.source,
            version: json.openscad.version,
            reason: json.openscad.reason,
            detail: json.openscad.detail,
            licenseNotices: json.openscad.licenseNotices,
          },
          capabilities: json.capabilities,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setToolchain({
          status: "error",
          message: err instanceof Error ? err.message : "无法读取 CAD 工具链状态",
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams({
      projectId,
      path: relativePath,
    });

    // A new compile attempt should immediately reset the preview panel state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: "loading", message: "正在编译 OpenSCAD…" });
    void (async () => {
      const wasm = await compileScadWithOpenScadWasm({ source: draftSource });
      if (cancelled) return;
      if (wasm.ok) {
        setState({
          status: "ready",
          base64: wasm.content,
          source: "openscad_wasm",
        });
        return;
      }

      try {
        const res = await fetch(`/api/workspace/cad/compile?${q}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as {
          content?: string;
          error?: string;
          detail?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          const fallback = await fetchPreviewStlFallback({
            projectId,
            relativePath,
          });
          if (cancelled) return;
          if (fallback) {
            setState({
              status: "ready",
              base64: fallback,
              source: "preview_stl",
              warning: `${compileErrorMessage(json.error)} 已显示工作区中的 preview.stl。`,
            });
            return;
          }
          const svgFallback = buildParameterSvgFallback(draftSource);
          if (svgFallback) {
            setState({
              status: "ready_svg",
              svg: svgFallback,
              source: "parameter_svg",
              warning: `${compileErrorMessage(json.error)} 已显示参数轮廓 SVG 预览。`,
            });
            return;
          }
          setState({
            status: "error",
            message: compileErrorMessage(json.error),
            detail: json.detail,
          });
          return;
        }
        setState({
          status: "ready",
          base64: json.content ?? "",
          source: "openscad",
        });
      } catch (err) {
        if (cancelled) return;
        const fallback = await fetchPreviewStlFallback({
          projectId,
          relativePath,
        });
        if (cancelled) return;
        if (fallback) {
          setState({
            status: "ready",
            base64: fallback,
            source: "preview_stl",
            warning: "OpenSCAD 编译请求失败，已显示工作区中的 preview.stl。",
          });
          return;
        }
        const svgFallback = buildParameterSvgFallback(draftSource);
        if (svgFallback) {
          setState({
            status: "ready_svg",
            svg: svgFallback,
            source: "parameter_svg",
            warning: "OpenSCAD 编译请求失败，已显示参数轮廓 SVG 预览。",
          });
          return;
        }
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "无法生成 SCAD 预览。",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, relativePath, draftSource, version]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-[var(--fg-tertiary)]">{fileName}</p>
        <button
          type="button"
          className="btn-icon"
          aria-label="重新编译"
          title="重新编译"
          onClick={retry}
        >
          <RotateCw className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs">
        <span
          className={`h-2 w-2 rounded-full ${
            toolchain.status === "ready" && toolchain.openscad.available
              ? "bg-emerald-500"
              : "bg-amber-500"
          }`}
        />
        <span className="font-medium text-[var(--fg)]">
          {toolchain.status === "loading"
            ? "正在检测 CAD 工具链"
            : toolchain.status === "error"
              ? "CAD 工具链状态未知"
              : toolchain.openscad.available
                ? "OpenSCAD Runtime 可用"
                : "OpenSCAD Runtime 未就绪"}
        </span>
        <span className="text-[var(--fg-tertiary)]">
          {toolchain.status === "ready" && toolchain.openscad.available
            ? `${toolchain.openscad.version ?? "托管运行时已检测到"} · SCAD/STL/DXF 可走真实编译${licenseNoticeLabel(toolchain.openscad.licenseNotices)}`
            : toolchain.status === "ready"
              ? "当前使用工作区 preview.stl 与参数化 DXF 兜底"
              : toolchain.status === "error"
                ? toolchain.message
                : "请稍候"}
        </span>
      </div>
      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-h-[320px] min-w-0 flex-col">
          {state.status === "ready" || state.status === "ready_svg" ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              {state.warning && (
                <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--fg-tertiary)]">
                  {state.warning}
                </p>
              )}
              <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--fg-tertiary)]">
                预览来源：
                {state.source === "openscad"
                  ? "OpenSCAD 实时编译 STL"
                  : state.source === "openscad_wasm"
                    ? "浏览器 OpenSCAD WASM 快速预览"
                    : state.source === "preview_stl"
                      ? "工作区 exports/preview.stl 兜底"
                      : "参数轮廓 SVG 预览"}
              </p>
              {state.status === "ready" ? (
                <StlPreview base64={state.base64} fileName={fileName} />
              ) : (
                <SvgPreview source={state.svg} fileName={fileName} />
              )}
            </div>
          ) : (
            <div className="flex min-h-[320px] flex-1 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg)] p-6 text-center">
              <div className="max-w-sm">
                <p className="text-sm font-medium text-[var(--fg)]">
                  {state.message}
                </p>
                {state.status === "error" && state.detail && (
                  <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-[var(--surface)] p-3 text-left text-[11px] text-[var(--fg-tertiary)]">
                    {state.detail}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
        <ScadParametersPanel
          projectId={projectId}
          relativePath={relativePath}
          source={draftSource}
          openscadAvailable={
            toolchain.status === "ready" ? toolchain.openscad.available : undefined
          }
          openscadVersion={
            toolchain.status === "ready" ? toolchain.openscad.version : undefined
          }
          onSaved={(nextSource) => {
            setDraftSource(nextSource);
            onSourceSaved?.(nextSource);
          }}
          onRefreshPreview={retry}
          onWorkspaceChanged={onWorkspaceChanged}
        />
      </div>
    </div>
  );
}
