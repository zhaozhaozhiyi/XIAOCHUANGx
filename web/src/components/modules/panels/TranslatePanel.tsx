"use client";

import { useState } from "react";
import { ArrowLeftRight, FileUp } from "lucide-react";
import { MOCK_TRANSLATE_HISTORY } from "@/lib/module-mock-data";

type Variant = "document" | "text" | "history";

const LANG_OPTIONS = ["自动检测", "中文", "英语"] as const;

export function TranslatePanel({ variant }: { variant: Variant }) {
  if (variant === "document") return <DocumentTranslate />;
  if (variant === "text") return <TextTranslate />;
  return <HistoryView />;
}

function LangPair({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={from}
        onChange={(e) => onFrom(e.target.value)}
        className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
      >
        {LANG_OPTIONS.map((l) => (
          <option key={l}>{l}</option>
        ))}
      </select>
      <ArrowLeftRight className="h-4 w-4 text-[var(--fg-tertiary)]" aria-hidden />
      <select
        value={to}
        onChange={(e) => onTo(e.target.value)}
        className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
      >
        {LANG_OPTIONS.filter((l) => l !== "自动检测").map((l) => (
          <option key={l}>{l}</option>
        ))}
      </select>
    </div>
  );
}

function DocumentTranslate() {
  const [from, setFrom] = useState("自动检测");
  const [to, setTo] = useState("中文");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <LangPair from={from} to={to} onFrom={setFrom} onTo={setTo} />
      <div className="card-flat border-2 border-dashed border-[var(--border)] p-12 text-center">
        <FileUp className="mx-auto h-10 w-10 text-[var(--fg-tertiary)]" strokeWidth={1.25} />
        <p className="mt-4 text-sm font-medium text-[var(--fg)]">上传待译文档</p>
        <p className="mt-2 text-xs text-[var(--fg-tertiary)]">
          保留标题层级与表格结构 · PDF / Word / Txt
        </p>
        <button type="button" className="btn btn-primary mt-6 text-sm">
          选择文件
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--fg-secondary)]">
        <input type="checkbox" defaultChecked className="rounded" />
        对照模式（原文-译文并排）
      </label>
    </div>
  );
}

function TextTranslate() {
  const [from, setFrom] = useState("中文");
  const [to, setTo] = useState("英语");
  const [source, setSource] = useState("");

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <LangPair from={from} to={to} onFrom={setFrom} onTo={setTo} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-white p-4">
          <label className="text-overline">原文</label>
          <textarea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            rows={10}
            placeholder="粘贴待译文本…"
            className="mt-2 w-full resize-none rounded-lg border border-[var(--border)] px-3 py-2 text-sm leading-relaxed"
          />
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <label className="text-overline">译文</label>
          <div className="mt-2 min-h-[240px] rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--fg-tertiary)]">
            {source.trim()
              ? "（演示）Translation will appear here after you click Translate."
              : "输入原文后点击翻译"}
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <button type="button" className="btn btn-primary text-sm" disabled={!source.trim()}>
          翻译
        </button>
      </div>
    </div>
  );
}

function HistoryView() {
  return (
    <div className="mx-auto max-w-3xl">
      <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white">
        {MOCK_TRANSLATE_HISTORY.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-[var(--sidebar-hover)]"
            >
              <div>
                <p className="text-sm font-medium text-[var(--fg)]">{item.title}</p>
                <p className="mt-0.5 text-xs text-[var(--fg-tertiary)]">
                  {item.from} → {item.to} ·{" "}
                  {item.mode === "document" ? "文档翻译" : "文本翻译"}
                </p>
              </div>
              <span className="shrink-0 text-xs text-[var(--fg-tertiary)]">
                {item.updatedAt}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
