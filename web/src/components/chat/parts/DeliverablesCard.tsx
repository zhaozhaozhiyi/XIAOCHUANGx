"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DeliverableItem, DeliverablesPart } from "@/lib/chat-parts";
import { deliverableTypeLabel } from "@/lib/deliverable-mime";
import { useOpenFileAt } from "@/hooks/useOpenFileAt";
import {
  ExternalLink,
  FileText,
  Film,
  Folder,
  FolderOpen,
  ImageIcon,
  Presentation,
} from "lucide-react";
import { useWorkspaceOptional } from "@/components/workspace/WorkspaceContext";
import { useWorkspaceProject } from "@/components/workspace/WorkspaceProjectContext";
import { isCadWorkbenchPath, selectMainCadPath } from "@/lib/cad-workbench";
import { getSessionProjectId, NO_PROJECT_ID } from "@/lib/research-projects";

function basename(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function preferDisplayItem(
  current: DeliverableItem,
  candidate: DeliverableItem,
): DeliverableItem {
  const currentDepth = current.path.split(/[\\/]/).length;
  const candidateDepth = candidate.path.split(/[\\/]/).length;
  const preferred =
    candidateDepth !== currentDepth
      ? candidateDepth > currentDepth
        ? candidate
        : current
      : candidate.path.length > current.path.length
        ? candidate
        : current;
  return current.kind === "primary" || candidate.kind === "primary"
    ? { ...preferred, kind: "primary" }
    : preferred;
}

function areEquivalentDeliverablePaths(a: string, b: string): boolean {
  return a === b || a.endsWith(`/${b}`) || b.endsWith(`/${a}`);
}

function dedupeDeliverableItems(items: DeliverableItem[]): DeliverableItem[] {
  const deduped: DeliverableItem[] = [];
  for (const item of items) {
    const existingIndex = deduped.findIndex((existing) =>
      areEquivalentDeliverablePaths(existing.path, item.path),
    );
    if (existingIndex === -1) {
      deduped.push(item);
      continue;
    }
    deduped[existingIndex] = preferDisplayItem(
      deduped[existingIndex]!,
      item,
    );
  }
  return deduped;
}

function RowIcon({
  path,
  mime,
  kind,
  className,
}: {
  path: string;
  mime?: string;
  kind?: DeliverableItem["kind"];
  className?: string;
}) {
  if (kind === "directory") {
    return <Folder className={className} aria-hidden />;
  }
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (mime?.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(ext)) {
    return <ImageIcon className={className} aria-hidden />;
  }
  if (
    mime?.startsWith("video/") ||
    ["mp4", "webm", "mov", "m4v", "ogg", "ogv"].includes(ext)
  ) {
    return <Film className={className} aria-hidden />;
  }
  if (ext === "pptx" || ext === "ppt" || mime?.includes("presentation")) {
    return <Presentation className={className} aria-hidden />;
  }
  return <FileText className={className} aria-hidden />;
}

function isMarkdownPath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".md");
}

function cadPreviewModeForPath(filePath: string) {
  return isCadWorkbenchPath(filePath) ? "preview" as const : undefined;
}

type ManifestAction = NonNullable<
  NonNullable<DeliverablesPart["manifest"]>["actions"]
>[number];

function ProjectManifestSummary({
  part,
  actionMessage,
  onAction,
}: {
  part: DeliverablesPart;
  actionMessage?: string | null;
  onAction: (action: ManifestAction) => void;
}) {
  const manifest = part.manifest;
  const config =
    manifest?.moduleId === "ppt"
      ? {
          badge: "PPT 项目",
          fallbackPrimary: "PPT 产物",
          previewLabel: "已进入预览阶段",
        }
      : manifest?.moduleId === "writing"
        ? {
            badge: "文档项目",
            fallbackPrimary: "文档产物",
            previewLabel: "已生成可预览文稿",
          }
        : manifest?.moduleId === "3d"
          ? {
              badge: "3D 项目",
              fallbackPrimary: "3D 产物",
              previewLabel: "已生成可预览模型",
            }
        : null;
  if (!manifest || !config) return null;
  const primaryLabel =
    manifest.primaryArtifact?.label ??
    manifest.primaryArtifact?.path ??
    part.primaryPath ??
    config.fallbackPrimary;
  const previewCount = manifest.previews?.length ?? 0;
  const generatedFormatLabels =
    manifest.generatedFormats
      ?.filter((item) => item.status === "available")
      .map((item) => item.type.toUpperCase()) ?? [];
  const conversionLabels =
    manifest.availableConversions?.map((item) =>
      item.status === "planned" ? `${item.label}（待接入）` : item.label,
    ) ?? [];
  const actions = manifest.actions ?? [];
  return (
    <div className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--accent)_18%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_7%,white)] px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--fg-tertiary)]">
        <span className="rounded-full bg-white/75 px-2 py-0.5 font-medium text-[var(--accent)]">
          {config.badge}
        </span>
        <span>{manifest.stage === "preview" ? config.previewLabel : "结构化产物已就绪"}</span>
        <span>·</span>
        <span>{manifest.artifacts.length} 个产物</span>
        {previewCount > 0 ? (
          <>
            <span>·</span>
            <span>{previewCount} 个预览</span>
          </>
        ) : null}
        {generatedFormatLabels.length > 0 ? (
          <>
            <span>·</span>
            <span>已生成格式 {generatedFormatLabels.join(" / ")}</span>
          </>
        ) : null}
        {conversionLabels.length > 0 ? (
          <>
            <span>·</span>
            <span>可生成 {conversionLabels.join(" / ")}</span>
          </>
        ) : null}
      </div>
      <div className="mt-1 truncate text-sm font-medium text-[var(--fg)]">
        {manifest.title}
      </div>
      <div className="mt-0.5 truncate text-xs text-[var(--fg-secondary)]">
        主产物：{primaryLabel}
      </div>
      {actions.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="rounded-md border border-[var(--border)] bg-white/80 px-2 py-1 text-xs text-[var(--fg-secondary)] transition hover:border-[color-mix(in_srgb,var(--accent)_28%,var(--border))] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--fg-secondary)]"
              disabled={!action.enabled}
              title={
                action.enabled ? undefined : "这个格式生成动作还未接入当前样板"
              }
              onClick={() => onAction(action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
      {actionMessage ? (
        <p className="mt-1 text-xs text-[var(--danger)]">{actionMessage}</p>
      ) : null}
    </div>
  );
}

function DeliverableRow({
  item,
  primary,
  showDocxGeneration,
  projectId,
  workspaceProjectId,
}: {
  item: DeliverableItem;
  primary?: boolean;
  showDocxGeneration?: boolean;
  projectId: string;
  workspaceProjectId?: string;
}) {
  const { openFileAt } = useOpenFileAt();
  const workspace = useWorkspaceOptional();
  const {
    workspaceProjectId: activeWorkspaceProjectId,
    setWorkspaceProject,
  } = useWorkspaceProject();
  const [generatingDocx, setGeneratingDocx] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generatedPath, setGeneratedPath] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const pendingOpenRef = useRef<{
    filePath: string;
    projectId: string;
  } | null>(null);
  const label = item.label ?? basename(item.path);
  const typeLabel =
    item.kind === "directory" ? "目录" : deliverableTypeLabel(item.path, item.mime);
  const canGenerateDocx = showDocxGeneration && isMarkdownPath(item.path);
  const itemWorkspaceProjectId = item.workspaceProjectId ?? workspaceProjectId;
  const canOpenInSystem =
    item.kind !== "directory" &&
    Boolean(workspace?.openFileInSystemForProject || workspace?.openFileInSystem);
  const canOpenPreview = Boolean(item.previewUrl);

  const continueWithFile = useCallback((filePath: string) => {
    window.dispatchEvent(
      new CustomEvent("jlc-compose-prefill", {
        detail: {
          text: `请基于工作区文件 @${filePath} 继续迭代：\n\n`,
          append: false,
          focus: true,
        },
      }),
    );
  }, []);

  const openCurrentWorkspaceFile = useCallback(
    async (filePath: string) => {
      if (!workspace) {
        setActionMessage("工作区面板尚未就绪");
        return;
      }
      setOpening(true);
      setActionMessage(null);
      try {
        const opened = await openFileAt({
          path: filePath,
          viewMode: cadPreviewModeForPath(filePath),
        });
        if (!opened) {
          setActionMessage("未能在当前工作区定位该文件，请确认文件已写入当前会话工作区");
          return;
        }
        setActionMessage(null);
      } catch (err) {
        setActionMessage(err instanceof Error ? err.message : "打开文件失败");
      } finally {
        setOpening(false);
      }
    },
    [openFileAt, workspace],
  );

  useEffect(() => {
    const pendingOpen = pendingOpenRef.current;
    if (!pendingOpen || activeWorkspaceProjectId !== pendingOpen.projectId) {
      return;
    }
    const next = pendingOpen.filePath;
    pendingOpenRef.current = null;
    void openCurrentWorkspaceFile(next);
  }, [activeWorkspaceProjectId, openCurrentWorkspaceFile]);

  const openDeliverable = useCallback(
    async (filePath: string) => {
      const targetProjectId = itemWorkspaceProjectId;
      if (
        targetProjectId &&
        workspace?.workspaceProjectId !== targetProjectId
      ) {
        setOpening(true);
        setActionMessage("正在切换到交付物工作区…");
        pendingOpenRef.current = { filePath, projectId: targetProjectId };
        setWorkspaceProject(targetProjectId);
        return;
      }
      await openCurrentWorkspaceFile(filePath);
    },
    [
      itemWorkspaceProjectId,
      openCurrentWorkspaceFile,
      setWorkspaceProject,
      workspace?.workspaceProjectId,
    ],
  );

  const generateDocx = useCallback(async () => {
    if (!canGenerateDocx || projectId === NO_PROJECT_ID) return;
    setGeneratingDocx(true);
    setGenerationError(null);
    try {
      const res = await fetch("/api/writing/export-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: item.path,
          projectId,
          writeToWorkspace: true,
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(json.message ?? json.error ?? `生成失败 (${res.status})`);
      }
      const json = (await res.json()) as {
        path?: string;
        message?: string;
      };
      if (!json.path) {
        throw new Error(json.message ?? "未返回生成文件路径");
      }
      setGeneratedPath(json.path);
      workspace?.refreshTree();
      void openFileAt(json.path);
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "生成 DOCX 失败");
    } finally {
      setGeneratingDocx(false);
    }
  }, [canGenerateDocx, item.path, openFileAt, projectId, workspace]);

  const openInSystem = useCallback(async () => {
    if (!workspace?.openFileInSystemForProject && !workspace?.openFileInSystem) {
      setActionMessage("当前环境不支持系统打开文件");
      return;
    }
    const targetProjectId = itemWorkspaceProjectId ?? workspace?.workspaceProjectId;
    if (!targetProjectId) {
      setActionMessage("未找到该交付物所属工作区");
      return;
    }
    setActionMessage(null);
    const result = workspace.openFileInSystemForProject
      ? await workspace.openFileInSystemForProject(targetProjectId, item.path)
      : { ok: await workspace.openFileInSystem(item.path) };
    setActionMessage(
      result.ok
        ? "已请求系统打开"
        : (result.message ?? "系统打开失败，请查看右侧工作区提示"),
    );
    if (result.ok) {
      window.setTimeout(() => setActionMessage(null), 1500);
    }
  }, [item.path, itemWorkspaceProjectId, workspace]);

  const showInFolder = useCallback(async (filePath: string) => {
    if (!workspace?.showFileInFolder) {
      setActionMessage("当前环境不支持在文件夹中显示");
      return;
    }
    setActionMessage(null);
    const ok = await workspace.showFileInFolder(filePath);
    setActionMessage(ok ? "已在系统文件夹中定位" : "定位失败，请查看右侧工作区提示");
    if (ok) {
      window.setTimeout(() => setActionMessage(null), 1500);
    }
  }, [workspace]);

  return (
    <div className="flex flex-col gap-1">
    <div
      className={`chat-deliverable-row flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5 text-left text-sm shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-colors hover:bg-[var(--sidebar-hover)] ${
        primary
          ? "border-[color-mix(in_srgb,var(--accent)_22%,var(--border))]"
          : ""
      }`}
      title={item.path}
    >
      <RowIcon
        path={item.path}
        mime={item.mime}
        kind={item.kind}
        className={`h-4 w-4 shrink-0 ${primary ? "text-[var(--accent)]" : "text-[var(--fg-tertiary)]"}`}
      />
      <button
        type="button"
        className="group min-w-0 flex-1 truncate text-left"
        disabled={opening}
        onClick={() => void openDeliverable(item.path)}
        title={opening ? "打开中…" : `打开 ${label}`}
      >
        <span
          className={`group-hover:underline ${
            primary
              ? "font-medium text-[var(--fg)]"
              : "text-[var(--fg-secondary)]"
          }`}
        >
          {label}
        </span>
        <span className="ml-2 text-xs text-[var(--fg-tertiary)]">
          {opening ? "打开中…" : typeLabel}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        {canOpenPreview ? (
          <a
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--accent)] hover:bg-[var(--accent-muted)]"
            href={item.previewUrl}
            target="_blank"
            rel="noreferrer"
          >
            打开预览
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        ) : null}
        {canGenerateDocx ? (
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-[var(--fg-secondary)] hover:bg-[var(--sidebar-hover)] disabled:opacity-50"
            disabled={generatingDocx}
            onClick={() => void generateDocx()}
          >
            {generatingDocx ? "生成中…" : "生成 DOCX"}
          </button>
        ) : null}
        {canOpenInSystem ? (
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-[var(--fg-secondary)] hover:bg-[var(--sidebar-hover)]"
            onClick={() => void openInSystem()}
            aria-label={`系统打开 ${label}`}
          >
            系统打开
          </button>
        ) : null}
        {item.kind !== "directory" ? (
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-[var(--fg-secondary)] hover:bg-[var(--sidebar-hover)]"
            onClick={() => continueWithFile(item.path)}
            aria-label={`继续迭代 ${label}`}
          >
            继续迭代
          </button>
        ) : null}
        {workspace?.showFileInFolder ? (
          <button
            type="button"
            className="btn-icon h-7 w-7"
            onClick={() => void showInFolder(item.path)}
            aria-label={`在文件夹中显示 ${label}`}
            title="在文件夹中显示"
          >
            <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        ) : null}
      </div>
    </div>
      {generationError ? (
        <p className="px-1 text-xs text-[var(--danger)]">{generationError}</p>
      ) : null}
      {actionMessage ? (
        <p className="px-1 text-xs text-[var(--danger)]">{actionMessage}</p>
      ) : null}
      {generatedPath ? (
        <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-[var(--fg-tertiary)]">
          <span>已生成 {generatedPath}</span>
          <button
            type="button"
            className="text-[var(--accent)] hover:underline"
            onClick={() => void openDeliverable(generatedPath)}
          >
            打开
          </button>
          {workspace?.showFileInFolder ? (
            <button
              type="button"
              className="text-[var(--accent)] hover:underline"
              onClick={() => void showInFolder(generatedPath)}
            >
              定位
            </button>
          ) : null}
            {workspace?.openFileInSystem ? (
              <button
                type="button"
                className="text-[var(--accent)] hover:underline"
                onClick={() => {
                  const targetProjectId =
                    itemWorkspaceProjectId ?? workspace.workspaceProjectId;
                  if (workspace.openFileInSystemForProject) {
                    void workspace.openFileInSystemForProject(
                      targetProjectId,
                      generatedPath,
                    );
                    return;
                  }
                  void workspace.openFileInSystem(generatedPath);
                }}
              >
                系统打开
              </button>
          ) : null}
          <button
            type="button"
            className="text-[var(--accent)] hover:underline"
            onClick={() => continueWithFile(generatedPath)}
          >
            继续迭代
          </button>
        </div>
      ) : null}
      {item.recordingUrl || item.devCommand ? (
        <div className="grid gap-1 px-1 text-xs leading-relaxed text-[var(--fg-tertiary)]">
          {item.previewUrl ? (
            <div>
              预览入口：{item.previewUrl}
              <span className="ml-1">
                {item.devServerStatus === "running"
                  ? "（dev server 已启动）"
                  : "（dev server 运行后可打开）"}
              </span>
            </div>
          ) : null}
          {item.recordingUrl ? (
            <div>录屏入口：{item.recordingUrl}</div>
          ) : null}
          {item.devCommand ? (
            <div>若预览打不开，先在项目目录运行：{item.devCommand}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function DeliverablesCard({ part }: { part: DeliverablesPart }) {
  const pathname = usePathname();
  const { openFileAt } = useOpenFileAt();
  const {
    workspaceProjectId: activeWorkspaceProjectId,
    setWorkspaceProject,
  } = useWorkspaceProject();
  const [manifestActionMessage, setManifestActionMessage] = useState<string | null>(
    null,
  );
  const pendingManifestOpenRef = useRef<{
    filePath: string;
    projectId: string;
  } | null>(null);
  const showDocxGeneration = pathname.startsWith("/writing");
  const sessionId =
    pathname.match(/^\/writing\/([^/]+)$/)?.[1] ??
    pathname.match(/^\/ppt\/([^/]+)$/)?.[1] ??
    pathname.match(/^\/3d\/([^/]+)$/)?.[1] ??
    pathname.match(/^\/video\/([^/]+)$/)?.[1] ??
    pathname.match(/^\/simulation\/([^/]+)$/)?.[1] ??
    pathname.match(/^\/chat\/([^/]+)$/)?.[1];
  const projectId = sessionId
    ? getSessionProjectId(sessionId)
    : NO_PROJECT_ID;
  const primaryPath =
    part.primaryPath ??
    part.items.find((i) => i.kind === "primary")?.path ??
    part.items[0]?.path;
  const items = dedupeDeliverableItems(part.items);
  const primaryFilename = primaryPath ? basename(primaryPath) : null;

  const primary =
    primaryFilename != null
      ? items.find((i) => basename(i.path) === primaryFilename)
      : undefined;
  const rest = items.filter((i) => i !== primary);
  const manifestProjectId = part.workspaceProjectId ?? part.manifest?.projectId;

  const continueWithManifestArtifact = useCallback((filePath?: string) => {
    window.dispatchEvent(
      new CustomEvent("jlc-compose-prefill", {
        detail: {
          text: filePath
            ? `请基于工作区文件 @${filePath} 继续迭代：\n\n`
            : "请继续修改这个项目：\n\n",
          append: false,
          focus: true,
        },
      }),
    );
  }, []);

  const openManifestFile = useCallback(
    async (
      filePath: string,
      options: { viewMode?: "preview" | "source" | "render" } = {},
    ) => {
      if (
        manifestProjectId &&
        activeWorkspaceProjectId !== manifestProjectId
      ) {
        setManifestActionMessage("正在切换到交付物工作区…");
        pendingManifestOpenRef.current = {
          filePath,
          projectId: manifestProjectId,
        };
        setWorkspaceProject(manifestProjectId);
        return;
      }
      setManifestActionMessage(null);
      const opened = await openFileAt({
        path: filePath,
        viewMode: options.viewMode ?? cadPreviewModeForPath(filePath),
      });
      setManifestActionMessage(
        opened ? null : "未能在当前工作区定位该文件，请确认文件已写入当前会话工作区",
      );
    },
    [
      activeWorkspaceProjectId,
      manifestProjectId,
      openFileAt,
      setWorkspaceProject,
    ],
  );

  useEffect(() => {
    const pendingOpen = pendingManifestOpenRef.current;
    if (!pendingOpen || activeWorkspaceProjectId !== pendingOpen.projectId) {
      return;
    }
    const next = pendingOpen.filePath;
    pendingManifestOpenRef.current = null;
    void openManifestFile(next, { viewMode: cadPreviewModeForPath(next) });
  }, [activeWorkspaceProjectId, openManifestFile]);

  const handleManifestAction = useCallback(
    (action: ManifestAction) => {
      const manifest = part.manifest;
      if (!manifest) return;
      if (!action.enabled) {
        setManifestActionMessage("这个格式生成动作还未接入当前样板");
        return;
      }
      const targetArtifact = action.targetArtifactId
        ? manifest.artifacts.find((artifact) => artifact.id === action.targetArtifactId)
        : manifest.primaryArtifact;
      if (action.kind === "preview") {
        if (manifest.moduleId === "3d") {
          const cadPath = selectMainCadPath([
            targetArtifact?.path,
            manifest.primaryArtifact?.path,
            part.primaryPath,
            ...manifest.artifacts.map((artifact) => artifact.path),
            ...(manifest.previews ?? []).map((preview) => preview.path),
            ...part.items.map((item) => item.path),
          ]);
          if (cadPath) {
            void openManifestFile(cadPath, { viewMode: "preview" });
            return;
          }
        }
        const preview =
          manifest.previews?.find((item) =>
            targetArtifact?.path ? item.path === targetArtifact.path : false,
          ) ?? manifest.previews?.[0];
        if (preview?.url) {
          window.open(preview.url, "_blank", "noopener,noreferrer");
          setManifestActionMessage(null);
          return;
        }
        const previewPath = preview?.path ?? targetArtifact?.path;
        if (previewPath) {
          void openManifestFile(previewPath);
          return;
        }
        setManifestActionMessage("未找到可打开的预览文件");
        return;
      }
      if (action.kind === "open") {
        if (targetArtifact?.path) {
          void openManifestFile(targetArtifact.path);
          return;
        }
        setManifestActionMessage("未找到可打开的产物文件");
        return;
      }
      if (action.kind === "continue" || action.kind === "revise") {
        continueWithManifestArtifact(targetArtifact?.path);
        setManifestActionMessage(null);
        return;
      }
      if (action.kind === "generate_format") {
        setManifestActionMessage("这个格式生成动作还未接入当前样板");
        return;
      }
      setManifestActionMessage("该动作暂未接入当前样板");
    },
    [
      continueWithManifestArtifact,
      openManifestFile,
      part.items,
      part.manifest,
      part.primaryPath,
    ],
  );

  return (
    <div className="chat-deliverables flex flex-col gap-2 text-sm">
      <ProjectManifestSummary
        part={part}
        actionMessage={manifestActionMessage}
        onAction={handleManifestAction}
      />
      {primary ? (
        <DeliverableRow
          item={primary}
          primary
          showDocxGeneration={showDocxGeneration}
          projectId={projectId}
          workspaceProjectId={part.workspaceProjectId}
        />
      ) : null}
      {rest.map((item) => (
        <DeliverableRow
          key={item.path}
          item={item}
          showDocxGeneration={showDocxGeneration}
          projectId={projectId}
          workspaceProjectId={part.workspaceProjectId}
        />
      ))}
    </div>
  );
}
