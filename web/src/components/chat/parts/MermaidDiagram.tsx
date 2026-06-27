"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  trackMermaidRenderFailed,
  trackMermaidRenderSuccess,
} from "@/lib/chat-part-telemetry";

type MermaidModule = typeof import("mermaid");

let mermaidInitDone = false;

async function getMermaid(): Promise<MermaidModule["default"]> {
  const mod = await import("mermaid");
  const mermaid = mod.default;
  if (!mermaidInitDone) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      flowchart: {
        useMaxWidth: true,
      },
    });
    mermaidInitDone = true;
  }
  return mermaid;
}

type MermaidDiagramProps = {
  source: string;
  sourceType: "research_map" | "markdown";
  partId?: string;
};

export function MermaidDiagram({ source, sourceType, partId }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const reportedRef = useRef<string | null>(null);
  const trimmedSource = useMemo(() => source.trim(), [source]);

  const handleCopySource = async () => {
    try {
      await navigator.clipboard.writeText(trimmedSource);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  useEffect(() => {
    if (!trimmedSource) return;

    let cancelled = false;
    const renderKey = `${sourceType}:${partId ?? "na"}:${trimmedSource.length}`;

    const renderDiagram = async () => {
      setLoading(true);
      setError(null);
      try {
        const mermaid = await getMermaid();
        const renderId = `jlc-mermaid-${Math.random().toString(36).slice(2, 11)}`;
        const result = await mermaid.render(renderId, trimmedSource);
        if (cancelled) return;
        setSvg(result.svg);
        if (reportedRef.current !== `ok:${renderKey}`) {
          trackMermaidRenderSuccess({
            sourceType,
            partId,
            sourceLength: trimmedSource.length,
          });
          reportedRef.current = `ok:${renderKey}`;
        }
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Mermaid render failed";
        setSvg(null);
        setError(message);
        if (reportedRef.current !== `err:${renderKey}`) {
          trackMermaidRenderFailed({
            sourceType,
            partId,
            sourceLength: trimmedSource.length,
            error: message.slice(0, 180),
          });
          reportedRef.current = `err:${renderKey}`;
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [partId, sourceType, trimmedSource]);

  if (!trimmedSource) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--warn)]">
        导图内容为空，无法渲染。
      </div>
    );
  }

  if (loading && !svg && !error) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--fg-tertiary)]">
        正在渲染导图...
      </div>
    );
  }

  if (error || !svg) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-[var(--warn)]">导图渲染失败，已回退源码展示。</p>
          <button
            type="button"
            className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--fg-secondary)] hover:bg-[var(--sidebar-hover)]"
            onClick={() => void handleCopySource()}
          >
            {copied ? "已复制" : "复制源码"}
          </button>
        </div>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-sm)] border border-[var(--border)]/70 bg-[color-mix(in_srgb,var(--surface)_90%,var(--sidebar-hover))] px-2 py-1.5 font-mono text-xs text-[var(--fg-secondary)]">
          {trimmedSource}
        </pre>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2 py-2">
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--fg-secondary)] hover:bg-[var(--sidebar-hover)]"
          onClick={() => void handleCopySource()}
        >
          {copied ? "已复制" : "复制源码"}
        </button>
      </div>
      <div className="overflow-x-auto">
      <div
        className="mermaid-svg-wrap min-w-[320px]"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      </div>
    </div>
  );
}
