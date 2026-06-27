/** 小窗品牌标：圆环图形 */
export function BrandMark({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const icon = size === "sm" ? "h-4 w-4" : "h-[22px] w-[22px]";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-accent shadow-[0_0_0_1px_var(--color-accent)] ${box} ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 16 16"
        className={`${icon} text-[#faf9f5]`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="8"
          cy="8"
          r="4.5"
          stroke="currentColor"
          strokeWidth="4"
        />
      </svg>
    </span>
  );
}
