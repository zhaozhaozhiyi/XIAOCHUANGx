"use client";

import { useEffect, useState } from "react";
import {
  fetchRuntimeHealth,
  runtimeStatusTitle,
  type RuntimeHealthResponse,
} from "@/lib/runtime-health";
import type { AgentId } from "@/lib/settings";

type HermesStatusDotProps = {
  /** 圆环描边容器，用于嵌在模型选择器内 */
  framed?: boolean;
  /** 当前顶栏选中的 Agent，用于 Companion 模式下展示该 CLI 状态 */
  agentId?: AgentId;
};

/** 对话顶栏：运行时连通状态（Companion 或 Hermes 开发捷径） */
export function HermesStatusDot({ framed = false, agentId }: HermesStatusDotProps) {
  const [health, setHealth] = useState<RuntimeHealthResponse | { status: "loading" }>({
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const result = await fetchRuntimeHealth();
      if (cancelled) return;
      setHealth(result);
    };

    void check();
    const timer = window.setInterval(() => void check(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const loading = "status" in health && health.status === "loading";
  const ready = !loading ? (health as RuntimeHealthResponse) : null;
  const isMockShortcut =
    !loading &&
    ready &&
    (ready.mode === "mock" ||
      (ready.execution === "hermes" && ready.ok));
  const dotClass = loading
    ? "bg-[var(--fg-tertiary)]"
    : isMockShortcut
      ? "bg-[var(--warning)]"
      : ready?.ok
        ? "bg-[var(--success)]"
        : "bg-[var(--danger)]";

  const title = loading
    ? "连接中…"
    : runtimeStatusTitle(ready!, agentId);

  const dot = (
    <span
      className={`rounded-full ${framed ? "h-1.5 w-1.5" : "h-2 w-2"} ${dotClass}`}
    />
  );

  if (framed) {
    return (
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)]"
        title={title}
        aria-label={title}
      >
        {dot}
      </span>
    );
  }

  return (
    <span className="shrink-0" title={title} aria-label={title}>
      {dot}
    </span>
  );
}
