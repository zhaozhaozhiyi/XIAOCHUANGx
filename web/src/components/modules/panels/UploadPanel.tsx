"use client";

import { useState } from "react";
import { useEnsureDefaultTaskWorkspace } from "@/hooks/useEnsureDefaultTaskWorkspace";

export function UploadPanel() {
  const [titleHint, setTitleHint] = useState("");
  const { ensuring, error, ensureWorkspace, clearEnsureError } =
    useEnsureDefaultTaskWorkspace();

  return (
    <div className="mx-auto max-w-xl">
      <div className="card-flat border-2 border-dashed border-[var(--border)] p-12 text-center">
        <p className="text-sm font-medium text-[var(--fg)]">上传会议音视频</p>
        <p className="mt-2 text-xs text-[var(--fg-tertiary)]">
          支持 mp3、mp4、wav、m4a，单文件建议 ≤ 4 小时
        </p>
        <input
          className="mt-4 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          placeholder="纪要标题（可选）"
          value={titleHint}
          onChange={(e) => {
            setTitleHint(e.target.value);
            if (error) clearEnsureError();
          }}
        />
        {error && (
          <p className="mt-3 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-left text-xs text-[var(--danger)]">
            {error}
          </p>
        )}
        <button
          type="button"
          className="btn btn-primary mt-6 text-sm"
          disabled={ensuring}
          onClick={() => {
            void ensureWorkspace({
              moduleId: "meeting",
              taskTitle: titleHint.trim() || undefined,
            });
          }}
        >
          {ensuring ? "创建工作区…" : "选择文件"}
        </button>
      </div>
    </div>
  );
}
