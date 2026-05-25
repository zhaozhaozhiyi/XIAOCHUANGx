"use client";

import { FileText } from "lucide-react";
import type { WorkspaceFileNode } from "@/lib/workspace";

export function MentionMenu({
  files,
  activeIndex,
  onSelect,
}: {
  files: WorkspaceFileNode[];
  activeIndex: number;
  onSelect: (file: WorkspaceFileNode) => void;
}) {
  if (files.length === 0) {
    return (
      <div className="mention-menu" role="listbox">
        <p className="px-3 py-2 text-xs text-[var(--fg-tertiary)]">
          当前项目内没有匹配的文件
        </p>
      </div>
    );
  }

  return (
    <ul className="mention-menu" role="listbox">
      {files.map((file, i) => (
        <li key={file.id} role="presentation">
          <button
            type="button"
            role="option"
            aria-selected={i === activeIndex}
            className={`mention-menu__item ${i === activeIndex ? "mention-menu__item--active" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(file);
            }}
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--fg-tertiary)]" strokeWidth={1.75} />
            <span className="min-w-0 flex-1 truncate text-left">{file.name}</span>
            {file.relativePath && file.relativePath !== file.name && (
              <span className="max-w-[40%] truncate text-xs text-[var(--fg-tertiary)]">
                {file.relativePath}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
