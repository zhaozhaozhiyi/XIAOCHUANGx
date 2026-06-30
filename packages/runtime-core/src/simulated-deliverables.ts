import { isComplexDeepQuestion, type ChatModeId } from "./chat-mode.js";

export type SimulatedDeliverablesPayload = {
  headline: string;
  primaryPath: string;
  workspaceProjectId?: string;
  items: Array<{
    path: string;
    label?: string;
    mime?: string;
    kind?: "primary" | "attachment" | "directory";
    workspaceProjectId?: string;
    previewUrl?: string;
    recordingUrl?: string;
    devCommand?: string;
    devServerStatus?: "running" | "unknown";
  }>;
};

/** 深度复杂问题 mock 的成品列表（S3.5c） */
export function getSimulatedDeliverables(
  mode: ChatModeId,
  text: string,
): SimulatedDeliverablesPayload | null {
  if (
    !isComplexDeepQuestion(text) ||
    (mode !== "deep" && mode !== "auto")
  ) {
    return null;
  }
  return {
    headline: "本轮交付文件如下：",
    primaryPath: "research_summary.md",
    items: [
      {
        path: "research_summary.md",
        label: "研究摘要",
        mime: "text/markdown",
        kind: "primary",
      },
      {
        path: "charts/policy_trend.png",
        label: "政策趋势图",
        mime: "image/png",
        kind: "attachment",
      },
      {
        path: "exports/briefing.pptx",
        label: "汇报幻灯片",
        mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        kind: "attachment",
      },
    ],
  };
}
