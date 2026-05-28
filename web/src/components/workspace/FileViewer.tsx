"use client";

import { Globe, RotateCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { MarkdownPreview } from "./MarkdownPreview";
import { PptxPreview } from "./PptxPreview";
import { FileSourceView } from "./FileSourceView";
import { ImagePreview } from "./ImagePreview";
import { PdfPreview } from "./PdfPreview";
import { DocxPreview } from "./DocxPreview";
import { workspaceErrorMessage } from "@/lib/workspace-errors";
import { inferMimeFromPath } from "@/lib/workspace-binary";
import { useWorkspace } from "./WorkspaceContext";

export function FileViewer() {
  const {
    selectedFile,
    activeTab,
    fileContent,
    fileBinaryBase64,
    fileLoading,
    fileError,
    fileViewMode,
    setFileViewMode,
    treePaneOpen,
    toggleTreePane,
    pendingReveal,
    clearPendingReveal,
    fileActionMessage,
    clearFileActionMessage,
    openBrowserTab,
  } = useWorkspace();
  const [htmlRenderVersion, setHtmlRenderVersion] = useState(0);

  const revealLine =
    selectedFile &&
    pendingReveal?.fileId === selectedFile.id
      ? pendingReveal.line
      : undefined;
  const revealEndLine =
    selectedFile &&
    pendingReveal?.fileId === selectedFile.id
      ? pendingReveal.endLine
      : undefined;

  useEffect(() => {
    if (!fileActionMessage) return;
    const t = window.setTimeout(() => clearFileActionMessage(), 4000);
    return () => window.clearTimeout(t);
  }, [fileActionMessage, clearFileActionMessage]);

  const body =
    selectedFile?.type === "file" ? (fileContent ?? "") : "";
  const fileErrorText = workspaceErrorMessage(fileError);
  const fileActionText = workspaceErrorMessage(fileActionMessage);
  const isFileSelected = selectedFile?.type === "file";
  const isMarkdown = isFileSelected && selectedFile.language === "markdown";
  const isHtml =
    isFileSelected &&
    (selectedFile.language === "html" || /\.html?$/i.test(selectedFile.name));
  const isPptx =
    isFileSelected &&
    (selectedFile.language === "pptx" ||
      selectedFile.name.toLowerCase().endsWith(".pptx"));
  const isImage =
    isFileSelected &&
    /\.(png|jpe?g|gif|webp|svg)$/i.test(selectedFile.name);
  const isPdf = isFileSelected && /\.pdf$/i.test(selectedFile.name);
  const isDocx = isFileSelected && /\.docx$/i.test(selectedFile.name);

  const openHtmlInBrowser = useCallback(() => {
    if (!body.trim()) return;
    const blob = new Blob([body], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    openBrowserTab(url);
  }, [body, openBrowserTab]);

  const refreshHtmlRender = useCallback(() => {
    setHtmlRenderVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!isFileSelected) return;
    if (isMarkdown) {
      if (fileViewMode !== "preview" && fileViewMode !== "source") {
        setFileViewMode("preview");
      }
      return;
    }
    if (isHtml) {
      if (fileViewMode !== "source" && fileViewMode !== "render") {
        setFileViewMode("render");
      }
      return;
    }
    if (fileViewMode !== "source") {
      setFileViewMode("source");
    }
  }, [fileViewMode, isFileSelected, isHtml, isMarkdown, setFileViewMode]);

  if (!selectedFile || selectedFile.type !== "file") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm text-[var(--fg-tertiary)]">
          {activeTab?.kind === "explorer"
            ? "在目录中选择文件以预览"
            : treePaneOpen
              ? "在左侧选择文件以预览"
              : "展开目录后选择文件，或使用导航打开"}
        </p>
        {!treePaneOpen && (
          <button
            type="button"
            className="btn btn-secondary px-3 py-1.5 text-xs"
            onClick={toggleTreePane}
          >
            展开目录
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <span className="min-w-0 truncate text-xs font-medium text-[var(--fg)]">
          {selectedFile.name}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {isMarkdown && (
            <div
              className="flex rounded-md border border-[var(--border)] bg-[var(--bg)] p-0.5 text-[11px]"
              role="tablist"
            >
              <button
                type="button"
                role="tab"
                aria-selected={fileViewMode === "preview"}
                onClick={() => setFileViewMode("preview")}
                className={`rounded px-2 py-0.5 ${
                  fileViewMode === "preview"
                    ? "bg-[var(--surface-elevated)] font-medium text-[var(--fg)] shadow-[var(--shadow-ring)]"
                    : "text-[var(--fg-tertiary)]"
                }`}
              >
                Preview
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={fileViewMode === "source"}
                onClick={() => setFileViewMode("source")}
                className={`rounded px-2 py-0.5 ${
                  fileViewMode === "source"
                    ? "bg-[var(--surface-elevated)] font-medium text-[var(--fg)] shadow-[var(--shadow-ring)]"
                    : "text-[var(--fg-tertiary)]"
                }`}
              >
                Markdown
              </button>
            </div>
          )}
          {isHtml && (
            <div
              className="flex rounded-md border border-[var(--border)] bg-[var(--bg)] p-0.5 text-[11px]"
              role="tablist"
            >
              <button
                type="button"
                role="tab"
                aria-selected={fileViewMode === "render"}
                onClick={() => setFileViewMode("render")}
                className={`rounded px-2 py-0.5 ${
                  fileViewMode === "render"
                    ? "bg-[var(--surface-elevated)] font-medium text-[var(--fg)] shadow-[var(--shadow-ring)]"
                    : "text-[var(--fg-tertiary)]"
                }`}
              >
                Render
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={fileViewMode === "source"}
                onClick={() => setFileViewMode("source")}
                className={`rounded px-2 py-0.5 ${
                  fileViewMode === "source"
                    ? "bg-[var(--surface-elevated)] font-medium text-[var(--fg)] shadow-[var(--shadow-ring)]"
                    : "text-[var(--fg-tertiary)]"
                }`}
              >
                Code
              </button>
            </div>
          )}
          {isHtml && (
            <button
              type="button"
              className="btn-icon"
              onClick={refreshHtmlRender}
              disabled={
                fileLoading || !!fileError || !body.trim() || fileViewMode !== "render"
              }
              aria-label="刷新渲染"
              title="刷新渲染"
            >
              <RotateCw className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          )}
          {isHtml && (
            <button
              type="button"
              className="btn-icon"
              onClick={openHtmlInBrowser}
              disabled={fileLoading || !!fileError || !body.trim()}
              aria-label="在浏览器中预览"
              title="在浏览器中预览"
            >
              <Globe className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      <div
        className={`min-h-0 flex-1 overflow-y-auto p-4 ${
          (isPptx || isImage || isPdf || isDocx) && fileBinaryBase64
            ? "flex flex-col"
            : ""
        }`}
      >
        {fileActionText && (
          <p className="mb-3 rounded-md border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
            {fileActionText}
          </p>
        )}
        {fileLoading && (
          <p className="text-sm text-[var(--fg-tertiary)]">加载中…</p>
        )}
        {fileErrorText && (
          <p className="text-sm text-[var(--danger)]">{fileErrorText}</p>
        )}
        {!fileLoading && !fileErrorText && isPptx && fileBinaryBase64 && (
          <PptxPreview
            base64={fileBinaryBase64}
            fileName={selectedFile.name}
          />
        )}
        {!fileLoading &&
          !fileErrorText &&
          !isPptx &&
          isMarkdown &&
          fileViewMode === "preview" && <MarkdownPreview source={body} />}
        {!fileLoading &&
          !fileErrorText &&
          !isPptx &&
          isHtml &&
          fileViewMode === "render" && (
            <iframe
              key={htmlRenderVersion}
              title={`${selectedFile.name} preview`}
              className="h-full min-h-[420px] w-full rounded-md border border-[var(--border)] bg-white"
              sandbox="allow-same-origin allow-scripts"
              srcDoc={body}
            />
          )}
        {!fileLoading &&
          !fileErrorText &&
          isImage &&
          fileBinaryBase64 && (
            <ImagePreview
              base64={fileBinaryBase64}
              mime={inferMimeFromPath(selectedFile.name)}
              fileName={selectedFile.name}
            />
          )}
        {!fileLoading &&
          !fileErrorText &&
          isPdf &&
          fileBinaryBase64 && (
            <PdfPreview
              base64={fileBinaryBase64}
              fileName={selectedFile.name}
            />
          )}
        {!fileLoading &&
          !fileErrorText &&
          isDocx &&
          fileBinaryBase64 && (
            <DocxPreview
              base64={fileBinaryBase64}
              fileName={selectedFile.name}
            />
          )}
        {!fileLoading &&
          !fileErrorText &&
          !isPptx &&
          !isImage &&
          !isPdf &&
          !isDocx &&
          (!isMarkdown && !isHtml || fileViewMode === "source") && (
            <FileSourceView
              content={body}
              language={selectedFile.language}
              highlightLine={revealLine}
              highlightEndLine={revealEndLine}
              onRevealed={clearPendingReveal}
            />
          )}
        {!fileLoading && !fileErrorText && isPptx && !fileBinaryBase64 && (
          <p className="text-sm text-[var(--fg-tertiary)]">无法加载演示文稿</p>
        )}
        {!fileLoading && !fileErrorText && isImage && !fileBinaryBase64 && (
          <p className="text-sm text-[var(--fg-tertiary)]">无法加载图片</p>
        )}
        {!fileLoading && !fileErrorText && isPdf && !fileBinaryBase64 && (
          <p className="text-sm text-[var(--fg-tertiary)]">无法加载 PDF</p>
        )}
        {!fileLoading && !fileErrorText && isDocx && !fileBinaryBase64 && (
          <p className="text-sm text-[var(--fg-tertiary)]">无法加载 DOCX</p>
        )}
      </div>
    </div>
  );
}
