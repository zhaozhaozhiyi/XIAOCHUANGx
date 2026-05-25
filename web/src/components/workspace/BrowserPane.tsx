"use client";

import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  hostAllowedForProxy,
  normalizeBrowserUrl,
  previewProxyUrl,
} from "@/lib/browser";
import { useWorkspace } from "./WorkspaceContext";

type FrameStatus = "idle" | "loading" | "ready" | "blocked";

function resolvePreviewSrc(url: string): string {
  try {
    if (hostAllowedForProxy(new URL(url).hostname)) {
      return previewProxyUrl(url);
    }
  } catch {
    /* ignore */
  }
  return url;
}

type BrowserPaneProps = {
  tabId: string;
};

export function BrowserPane({ tabId }: BrowserPaneProps) {
  const { getBrowserState, updateBrowserState } = useWorkspace();
  const state = getBrowserState(tabId);
  const { inputUrl, currentUrl, history, historyIndex } = state;
  const [frameStatus, setFrameStatus] = useState<FrameStatus>(
    currentUrl ? "loading" : "idle",
  );
  const historyIndexRef = useRef(historyIndex);
  historyIndexRef.current = historyIndex;
  const iframeKey = useRef(0);

  const hasPage = currentUrl !== null;

  const iframeSrc = useMemo(
    () => (currentUrl ? resolvePreviewSrc(currentUrl) : null),
    [currentUrl],
  );

  const navigate = useCallback(
    (raw: string, pushHistory = true) => {
      const normalized = normalizeBrowserUrl(raw);
      if (!normalized) return;

      setFrameStatus("loading");
      iframeKey.current += 1;

      if (pushHistory) {
        const idx = historyIndexRef.current;
        const nextHistory = [...history.slice(0, idx + 1), normalized];
        const newIndex = nextHistory.length - 1;
        updateBrowserState(tabId, {
          inputUrl: normalized,
          currentUrl: normalized,
          history: nextHistory,
          historyIndex: newIndex,
        });
      } else {
        updateBrowserState(tabId, {
          inputUrl: normalized,
          currentUrl: normalized,
        });
      }
    },
    [history, tabId, updateBrowserState],
  );

  const goBack = () => {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    const url = history[nextIndex];
    setFrameStatus("loading");
    iframeKey.current += 1;
    updateBrowserState(tabId, {
      historyIndex: nextIndex,
      currentUrl: url,
      inputUrl: url,
    });
  };

  const goForward = () => {
    if (historyIndex < 0 || historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    const url = history[nextIndex];
    setFrameStatus("loading");
    iframeKey.current += 1;
    updateBrowserState(tabId, {
      historyIndex: nextIndex,
      currentUrl: url,
      inputUrl: url,
    });
  };

  const refresh = () => {
    if (!currentUrl) return;
    setFrameStatus("loading");
    iframeKey.current += 1;
  };

  const setInputUrl = (value: string) => {
    updateBrowserState(tabId, { inputUrl: value });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <button
          type="button"
          className="btn-icon"
          onClick={goBack}
          disabled={!hasPage || historyIndex <= 0}
          aria-label="后退"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="btn-icon"
          onClick={goForward}
          disabled={!hasPage || historyIndex >= history.length - 1}
          aria-label="前进"
        >
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="btn-icon"
          onClick={refresh}
          disabled={!hasPage}
          aria-label="刷新"
        >
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
        <Globe className="ml-1 h-3.5 w-3.5 shrink-0 text-[var(--fg-tertiary)]" strokeWidth={1.75} />
        <input
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") navigate(inputUrl);
          }}
          placeholder="输入网址，Enter 预览"
          className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1 font-mono text-xs text-[var(--fg)] outline-none placeholder:text-[var(--fg-tertiary)] focus:border-[var(--focus)]"
          spellCheck={false}
          aria-label="网址"
        />
        {hasPage ? (
          <a
            href={currentUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-icon"
            aria-label="在新标签页打开"
            title="在新标签页打开"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
          </a>
        ) : (
          <span className="size-8 shrink-0" aria-hidden />
        )}
      </div>

      <div className="relative min-h-0 flex-1 bg-[var(--bg)]">
        {!hasPage && (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <Globe className="h-8 w-8 text-[var(--fg-muted)]" strokeWidth={1.25} />
            <p className="text-sm text-[var(--fg-tertiary)]">输入网址开始预览</p>
            <button
              type="button"
              className="btn btn-secondary text-xs"
              onClick={() => navigate("http://localhost:3000")}
            >
              打开 localhost:3000
            </button>
          </div>
        )}

        {hasPage && frameStatus === "loading" && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg)]/60">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--fg-tertiary)]" />
          </div>
        )}

        {hasPage && frameStatus === "blocked" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[var(--bg)] p-6 text-center">
            <p className="text-sm text-[var(--fg-secondary)]">该页面无法内嵌预览</p>
            <a
              href={currentUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary text-xs"
            >
              在新标签页打开
            </a>
          </div>
        )}

        {hasPage && iframeSrc && (
          <iframe
            key={iframeKey.current}
            title="网页预览"
            src={iframeSrc}
            className="h-full w-full border-0 bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            onLoad={() => setFrameStatus("ready")}
            onError={() => setFrameStatus("blocked")}
          />
        )}
      </div>
    </div>
  );
}
