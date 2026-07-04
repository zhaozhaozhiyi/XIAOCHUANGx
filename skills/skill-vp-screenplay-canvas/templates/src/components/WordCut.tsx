import type { CSSProperties, ReactNode } from "react";

interface Props {
  show: boolean;
  delay?: number;
  duration?: number;
  className?: string;
  children: ReactNode;
}

export function WordCut({
  show,
  delay = 0,
  duration,
  className,
  children,
}: Props) {
  const cls = ["mask-reveal", show ? "in" : "", className]
    .filter(Boolean)
    .join(" ");
  const style: CSSProperties = {
    display: "inline-block",
    transitionDelay: show ? `${delay}ms` : "0ms",
    ...(duration ? { transitionDuration: `${duration}ms` } : null),
  };
  return (
    <span className={cls} style={style}>
      {children}
    </span>
  );
}
