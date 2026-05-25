/** 对话区底部：AI 内容免责提示（常驻） */
export function ChatAiDisclaimer({
  className = "mt-2 text-center text-xs text-[var(--fg-tertiary)]",
}: {
  className?: string;
}) {
  return <p className={className}>内容由 AI 生成，请谨慎核实</p>;
}
