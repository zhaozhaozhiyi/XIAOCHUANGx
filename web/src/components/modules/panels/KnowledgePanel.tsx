"use client";

import { useState } from "react";
import { FileText, Search, Upload } from "lucide-react";
import { MOCK_KB_DOCUMENTS, MOCK_SOURCE_ITEMS } from "@/lib/module-mock-data";

type Variant = "documents" | "qa" | "sources";

export function KnowledgePanel({ variant }: { variant: Variant }) {
  if (variant === "documents") return <DocumentsView />;
  if (variant === "qa") return <QaView />;
  return <SourcesView />;
}

function DocumentsView() {
  const [query, setQuery] = useState("");

  const filtered = MOCK_KB_DOCUMENTS.filter(
    (d) =>
      !query.trim() ||
      d.name.toLowerCase().includes(query.toLowerCase()) ||
      d.tags.some((t) => t.includes(query)),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-tertiary)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索文档、标签…"
            className="w-full rounded-lg border border-[var(--border)] bg-white py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <button type="button" className="btn btn-primary inline-flex items-center gap-2 text-sm">
          <Upload className="h-4 w-4" strokeWidth={1.75} />
          上传文档
        </button>
      </div>

      <p className="text-xs text-[var(--fg-tertiary)]">
        支持 PDF、Word、Txt、Markdown · 个人配额演示 12.4 / 50 GB
      </p>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">
              <th className="px-4 py-3 font-medium">名称</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">格式</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">标签</th>
              <th className="px-4 py-3 font-medium">更新</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filtered.map((doc) => (
              <tr key={doc.id} className="hover:bg-[var(--sidebar-hover)]">
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2 font-medium text-[var(--fg)]">
                    <FileText className="h-4 w-4 shrink-0 text-[var(--fg-tertiary)]" />
                    {doc.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--fg-tertiary)] sm:hidden">
                    {doc.format} · {doc.size}
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-[var(--fg-secondary)] sm:table-cell">
                  {doc.format} · {doc.size}
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {doc.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-[var(--accent-muted)] px-2 py-0.5 text-xs text-[var(--accent)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-[var(--fg-tertiary)]">{doc.updatedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-[var(--fg-tertiary)]">无匹配文档</p>
        )}
      </div>
    </div>
  );
}

function QaView() {
  const [question, setQuestion] = useState("");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-white p-4">
        <label className="text-sm font-medium text-[var(--fg)]">向知识库提问</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          placeholder="例如：三家机构对螺纹钢库存的观点有何异同？"
          className="mt-2 w-full resize-none rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
        />
        <div className="mt-3 flex justify-end">
          <button type="button" className="btn btn-primary text-sm" disabled={!question.trim()}>
            开始问答
          </button>
        </div>
      </div>

      <div className="card-flat space-y-3 p-5">
        <p className="text-overline">示例回答（演示）</p>
        <p className="text-sm leading-relaxed text-[var(--fg)]">
          根据库内三份文档，机构 A 认为社会库存环比去化放缓，机构 B 强调终端需求偏弱，机构 C
          则关注出口扰动。综合判断短期价格震荡偏强。
        </p>
        <ul className="space-y-2 border-t border-[var(--border)] pt-3">
          {[
            { doc: "2025Q1 螺纹钢周报.pdf", page: "P.12" },
            { doc: "原油多空观点对比.docx", page: "§3.2" },
          ].map((ref) => (
            <li key={ref.doc}>
              <button
                type="button"
                className="text-sm text-[var(--accent)] hover:underline"
              >
                {ref.doc} · {ref.page}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SourcesView() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <p className="text-sm text-[var(--fg-secondary)]">
        选择库内文档参与异同分析，结果可链至对话模块继续追问
      </p>
      <ul className="grid gap-3 sm:grid-cols-3">
        {MOCK_SOURCE_ITEMS.map((item) => (
          <li
            key={item.id}
            className="card-flat flex flex-col gap-2 p-4 transition-shadow hover:shadow-[var(--shadow-whisper)]"
          >
            <span className="text-sm font-medium">{item.name}</span>
            <span
              className={`w-fit rounded-md px-2 py-0.5 text-xs ${
                item.bias === "偏多"
                  ? "bg-emerald-50 text-emerald-800"
                  : item.bias === "偏空"
                    ? "bg-red-50 text-red-800"
                    : "bg-[var(--surface)] text-[var(--fg-secondary)]"
              }`}
            >
              {item.bias}
            </span>
            <span className="text-xs text-[var(--fg-tertiary)]">更新 {item.updated}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-primary w-full text-sm sm:w-auto">
        生成异同分析报告
      </button>
    </div>
  );
}
