"use client";

export function UploadPanel() {
  return (
    <div className="mx-auto max-w-xl">
      <div className="card-flat border-2 border-dashed border-[var(--border)] p-12 text-center">
        <p className="text-sm font-medium text-[var(--fg)]">上传会议音视频</p>
        <p className="mt-2 text-xs text-[var(--fg-tertiary)]">
          支持 mp3、mp4、wav、m4a，单文件建议 ≤ 4 小时
        </p>
        <button type="button" className="btn btn-primary mt-6 text-sm">
          选择文件
        </button>
      </div>
    </div>
  );
}
