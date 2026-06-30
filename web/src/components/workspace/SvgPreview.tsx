"use client";

type Props = {
  source: string;
  fileName: string;
};

export function SvgPreview({ source, fileName }: Props) {
  return (
    <div className="flex min-h-[320px] flex-1 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <iframe
        title={`${fileName} SVG preview`}
        className="h-full min-h-[320px] w-full rounded-lg border border-[var(--border)] bg-white"
        sandbox=""
        srcDoc={source}
      />
    </div>
  );
}
