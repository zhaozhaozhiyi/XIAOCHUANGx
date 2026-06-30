import type { CSSProperties } from "react";
import type { AgentId } from "@/lib/settings";

type Props = {
  id: AgentId;
  size?: number;
  className?: string;
};

/**
 * 已登记 CLI 的品牌标识。SVG 优先（矢量、单文件、可随主题缩放），
 * Devin 官方仅提供位图，故以 PNG 兜底。新增品牌时把优化后的文件放入
 * `public/agent-icons/`，并在此登记扩展名即可。
 */
const ICON_EXT: Partial<Record<AgentId, "svg" | "png">> = {
  codex: "svg",
  claude: "svg",
  hermes: "svg",
  "cursor-agent": "svg",
  gemini: "svg",
  opencode: "svg",
  copilot: "svg",
  qoder: "svg",
  deepseek: "svg",
  devin: "png",
  pi: "svg",
  kiro: "svg",
  kilo: "svg",
  vibe: "svg",
  openclaw: "svg",
};

/**
 * 单色剪影标识：文件本身用固定深色填充，渲染时通过 CSS mask + currentColor
 * 上色，从而跟随周围文本颜色（浅色/深色主题都清晰可读）。
 */
const MONO_ICONS = new Set<AgentId>([
  "cursor-agent",
  "opencode",
  "hermes",
  "kilo",
]);

export function AgentIcon({ id, size = 28, className }: Props) {
  const ext = ICON_EXT[id];

  if (ext) {
    const src = `/agent-icons/${id}.${ext}`;
    if (ext === "svg" && MONO_ICONS.has(id)) {
      const style: CSSProperties = {
        width: size,
        height: size,
        backgroundColor: "currentColor",
        WebkitMaskImage: `url("${src}")`,
        maskImage: `url("${src}")`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      };
      return (
        <span
          className={className}
          style={style}
          aria-hidden="true"
          role="presentation"
        />
      );
    }
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={className}
        style={{ objectFit: "contain" }}
        aria-hidden="true"
        draggable={false}
      />
    );
  }

  const initial = (id.match(/[a-z]/i)?.[0] ?? "?").toUpperCase();
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 8,
        background: "var(--border)",
        color: "var(--fg-secondary)",
        fontSize: Math.round(size * 0.42),
        fontWeight: 600,
        lineHeight: 1,
      }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
