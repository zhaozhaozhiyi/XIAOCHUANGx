import Image from "next/image";

/** 小窗品牌标：复用桌面图标源生成的 Web icon.svg */
export function BrandMark({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${box} ${className}`}
      aria-hidden
    >
      <Image
        src="/icon.svg"
        alt=""
        width={32}
        height={32}
        className="h-full w-full select-none object-contain"
        draggable={false}
      />
    </span>
  );
}
