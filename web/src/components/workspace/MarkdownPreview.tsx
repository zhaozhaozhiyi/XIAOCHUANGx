"use client";

/** 轻量 Markdown 预览（原型，无额外依赖） */
export function MarkdownPreview({ source }: { source: string }) {
  const blocks = source.split(/\n\n+/);

  return (
    <article className="workspace-md space-y-4 text-[15px] leading-relaxed text-[var(--fg)]">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith("```")) {
          const lines = trimmed.split("\n");
          const code = lines.slice(1, lines[lines.length - 1] === "```" ? -1 : undefined).join("\n");
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-[13px]"
            >
              <code>{code}</code>
            </pre>
          );
        }

        if (trimmed.startsWith("# ")) {
          return (
            <h1 key={i} className="font-display text-xl font-medium text-[var(--fg)]">
              {trimmed.slice(2)}
            </h1>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={i} className="font-display text-lg font-medium text-[var(--fg)]">
              {trimmed.slice(3)}
            </h2>
          );
        }
        if (trimmed.startsWith("### ")) {
          return (
            <h3 key={i} className="text-base font-medium text-[var(--fg)]">
              {trimmed.slice(4)}
            </h3>
          );
        }

        if (trimmed.startsWith("> ")) {
          return (
            <blockquote
              key={i}
              className="rounded-lg border-l-2 border-[var(--accent)] bg-[var(--accent-muted)]/40 px-4 py-2 text-sm text-[var(--fg-secondary)]"
            >
              {trimmed
                .split("\n")
                .map((l) => l.replace(/^>\s?/, ""))
                .join("\n")}
            </blockquote>
          );
        }

        if (trimmed.includes("\n|") || trimmed.startsWith("|")) {
          const rows = trimmed.split("\n").filter((r) => r.includes("|"));
          return (
            <div key={i} className="overflow-x-auto">
              <table className="w-full min-w-[280px] border-collapse text-sm">
                <tbody>
                  {rows.map((row, ri) => {
                    if (/^\|[\s\-:|]+\|$/.test(row.replace(/\s/g, ""))) return null;
                    const cells = row
                      .split("|")
                      .slice(1, -1)
                      .map((c) => c.trim());
                    const Tag = ri === 0 ? "th" : "td";
                    return (
                      <tr key={ri} className="border-b border-[var(--border)]">
                        {cells.map((cell, ci) => (
                          <Tag
                            key={ci}
                            className={`px-3 py-2 text-left ${
                              Tag === "th"
                                ? "font-medium text-[var(--fg)]"
                                : "text-[var(--fg-secondary)]"
                            }`}
                          >
                            {cell}
                          </Tag>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        }

        if (/^[-*]\s/m.test(trimmed) || /^\d+\.\s/m.test(trimmed)) {
          const items = trimmed.split("\n").filter(Boolean);
          const ordered = /^\d+\.\s/.test(items[0] ?? "");
          const List = ordered ? "ol" : "ul";
          return (
            <List
              key={i}
              className={`space-y-1 pl-5 text-[var(--fg-secondary)] ${
                ordered ? "list-decimal" : "list-disc"
              }`}
            >
              {items.map((item, li) => (
                <li key={li}>{item.replace(/^[-*]\s|^\d+\.\s/, "")}</li>
              ))}
            </List>
          );
        }

        if (trimmed.startsWith("```")) {
          return null;
        }

        return (
          <p key={i} className="whitespace-pre-wrap text-[var(--fg-secondary)]">
            {trimmed}
          </p>
        );
      })}
    </article>
  );
}
