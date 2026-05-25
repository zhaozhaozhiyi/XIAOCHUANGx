"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { renderInlineMarkdown } from "@/components/chat/parts/chat-markdown-inline";
import { prepareChatMarkdown } from "@/lib/prepare-chat-markdown";

type Block =
  | { type: "hr" }
  | { type: "h"; level: 1 | 2 | 3; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "p"; text: string }
  | { type: "code"; text: string }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "image"; alt: string; src: string };

function isHr(line: string): boolean {
  return /^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim());
}

function headingLevel(line: string): 1 | 2 | 3 | null {
  const m = /^(#{1,3})\s+(.+)$/.exec(line.trim());
  if (!m) return null;
  return m[1]!.length as 1 | 2 | 3;
}

function isUlItem(line: string): boolean {
  return /^[-*]\s+/.test(line.trim());
}

function isOlItem(line: string): boolean {
  return /^\d+\.\s+/.test(line.trim());
}

function isTableRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith("|") && t.length > 1;
}

function isTableSeparator(line: string): boolean {
  const t = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return /^[\s|:-]+$/.test(t) && /-/.test(t);
}

function parseTableCells(line: string): string[] {
  const trimmed = line.trim();
  const inner = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const body = inner.endsWith("|") ? inner.slice(0, -1) : inner;
  return body.split("|").map((c) => c.trim());
}

function parseStandaloneImage(line: string): { alt: string; src: string } | null {
  const m = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/.exec(line.trim());
  if (!m) return null;
  return { alt: m[1] ?? "", src: m[2]! };
}

function parseBlocks(source: string): Block[] {
  const lines = prepareChatMarkdown(source).split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i]!;
    const line = raw.trim();
    if (!line) {
      i += 1;
      continue;
    }

    const standaloneImg = parseStandaloneImage(line);
    if (standaloneImg) {
      blocks.push({ type: "image", ...standaloneImg });
      i += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]!.trim().startsWith("```")) {
        codeLines.push(lines[i]!);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: "code", text: codeLines.join("\n") });
      continue;
    }

    if (isHr(line)) {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    const h = headingLevel(line);
    if (h) {
      blocks.push({
        type: "h",
        level: h,
        text: line.replace(/^#{1,3}\s+/, ""),
      });
      i += 1;
      continue;
    }

    if (isTableRow(line)) {
      const tableRows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i]!)) {
        const rowLine = lines[i]!.trim();
        if (!isTableSeparator(rowLine)) {
          tableRows.push(parseTableCells(rowLine));
        }
        i += 1;
      }
      if (tableRows.length > 0) {
        const [header, ...rows] = tableRows;
        blocks.push({
          type: "table",
          header: header ?? [],
          rows,
        });
      }
      continue;
    }

    if (isUlItem(line)) {
      const items: string[] = [];
      while (i < lines.length && isUlItem(lines[i]!)) {
        items.push(lines[i]!.trim().replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (isOlItem(line)) {
      const items: string[] = [];
      while (i < lines.length && isOlItem(lines[i]!)) {
        items.push(lines[i]!.trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length) {
      const t = lines[i]!.trim();
      if (!t) break;
      if (
        isHr(t) ||
        headingLevel(t) ||
        isUlItem(t) ||
        isOlItem(t) ||
        isTableRow(t) ||
        t.startsWith("```") ||
        parseStandaloneImage(t)
      ) {
        break;
      }
      para.push(t);
      i += 1;
    }
    if (para.length) blocks.push({ type: "p", text: para.join(" ") });
  }

  return blocks;
}

function MarkdownTable({
  header,
  rows,
}: {
  header: string[];
  rows: string[][];
}) {
  const colCount = Math.max(
    header.length,
    ...rows.map((r) => r.length),
    1,
  );

  return (
    <div className="my-2 overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full min-w-[280px] border-collapse text-sm">
        <thead className="bg-[var(--surface)]">
          <tr>
            {Array.from({ length: colCount }, (_, ci) => (
              <th
                key={ci}
                className="border-b border-[var(--border)] px-3 py-2 text-left font-medium text-[var(--fg)]"
              >
                {header[ci]
                  ? renderInlineMarkdown(header[ci]!, `th-${ci}`)
                  : "\u00a0"}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={colCount}
                className="px-3 py-2 text-[var(--fg-tertiary)]"
              >
                （空表，可继续填写）
              </td>
            </tr>
          ) : (
            rows.map((row, ri) => (
              <tr
                key={ri}
                className="border-b border-[var(--border)] last:border-0"
              >
                {Array.from({ length: colCount }, (_, ci) => (
                  <td
                    key={ci}
                    className="px-3 py-2 text-[var(--fg-secondary)] align-top"
                  >
                    {row[ci]
                      ? renderInlineMarkdown(row[ci]!, `td-${ri}-${ci}`)
                      : "\u00a0"}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

type Props = {
  markdown: string;
  streaming?: boolean;
};

export function ChatMarkdown({ markdown, streaming }: Props) {
  const blocks = useMemo(() => parseBlocks(markdown), [markdown]);

  if (!blocks.length && !streaming) return null;

  const renderBlock = (block: Block, i: number): ReactNode => {
    switch (block.type) {
      case "hr":
        return (
          <hr
            key={i}
            className="my-2 border-0 border-t border-[var(--border)]"
          />
        );
      case "h":
        if (block.level === 1) {
          return (
            <h3
              key={i}
              className="mb-1 mt-2 text-base font-medium text-[var(--fg)] first:mt-0"
            >
              {renderInlineMarkdown(block.text, `h-${i}`)}
            </h3>
          );
        }
        if (block.level === 2) {
          return (
            <h4
              key={i}
              className="mb-1 mt-2 text-[15px] font-medium text-[var(--fg)] first:mt-0"
            >
              {renderInlineMarkdown(block.text, `h-${i}`)}
            </h4>
          );
        }
        return (
          <h5
            key={i}
            className="mb-1 mt-1.5 text-sm font-medium text-[var(--fg)] first:mt-0"
          >
            {renderInlineMarkdown(block.text, `h-${i}`)}
          </h5>
        );
      case "ul":
        return (
          <ul key={i} className="my-1 list-disc space-y-0.5 pl-5">
            {block.items.map((item, li) => (
              <li key={li}>{renderInlineMarkdown(item, `ul-${i}-${li}`)}</li>
            ))}
          </ul>
        );
      case "ol":
        return (
          <ol key={i} className="my-1 list-decimal space-y-0.5 pl-5">
            {block.items.map((item, li) => (
              <li key={li}>{renderInlineMarkdown(item, `ol-${i}-${li}`)}</li>
            ))}
          </ol>
        );
      case "code":
        return (
          <pre
            key={i}
            className="my-2 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-[13px] text-[var(--fg)]"
          >
            <code>{block.text}</code>
          </pre>
        );
      case "table":
        return (
          <MarkdownTable
            key={i}
            header={block.header}
            rows={block.rows}
          />
        );
      case "image":
        return (
          <figure key={i} className="my-2">
            <img
              src={block.src}
              alt={block.alt}
              className="max-h-80 max-w-full rounded-lg border border-[var(--border)] object-contain"
              loading="lazy"
            />
            {block.alt ? (
              <figcaption className="mt-1 text-xs text-[var(--fg-tertiary)]">
                {block.alt}
              </figcaption>
            ) : null}
          </figure>
        );
      case "p":
        return (
          <p key={i} className="my-1 first:mt-0 last:mb-0">
            {renderInlineMarkdown(block.text, `p-${i}`)}
          </p>
        );
      default:
        return null;
    }
  };

  return (
    <article className="chat-md text-[15px] leading-relaxed text-[var(--fg-secondary)]">
      {blocks.map(renderBlock)}
      {streaming && (
        <span
          className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-[var(--accent)] align-middle"
          aria-hidden
        />
      )}
    </article>
  );
}
