import { isWaitingUserSignal } from "@/lib/chat-history";

export type ActivityTone = "neutral" | "running" | "wait" | "success" | "error";

const statusDisplayText: Record<string, string> = {
  accepted: "正在准备",
  queued: "排队中",
  pending: "等待执行",
  requesting: "正在请求",
  request: "正在请求",
  running: "进行中",
  processing: "处理中",
  streaming: "生成中",
  in_progress: "进行中",
  working: "处理中",
  thinking: "思考中",
  success: "完成",
  succeeded: "完成",
  complete: "完成",
  completed: "完成",
  done: "完成",
  error: "失败",
  failed: "失败",
  failure: "失败",
  cancelled: "已中断",
  canceled: "已中断",
  waiting_user: "待你处理",
  needs_input: "待你处理",
};

const runningStatuses = new Set([
  "accepted",
  "queued",
  "pending",
  "request",
  "requesting",
  "running",
  "processing",
  "streaming",
  "in_progress",
  "working",
  "thinking",
]);

function normalizeStatus(value: string): string {
  return value.trim().toLowerCase().replace(/[\s.-]+/g, "_");
}

export function isKnownActivityStatus(value?: string): boolean {
  if (!value) return false;
  return normalizeStatus(value) in statusDisplayText;
}

export function isRunningActivityStatus(value?: string): boolean {
  if (!value) return false;
  return runningStatuses.has(normalizeStatus(value));
}

export function activityStatusDisplayText(value?: string): string {
  const raw = value?.trim() ?? "";
  if (!raw) return "";
  return statusDisplayText[normalizeStatus(raw)] ?? raw;
}

export function activityTone(
  label: string,
  phaseOrStatus?: string,
): ActivityTone {
  const p = (phaseOrStatus ?? "").toLowerCase();
  if (
    p === "success" ||
    p === "completed" ||
    p === "complete" ||
    p === "succeeded"
  ) {
    return "success";
  }
  if (
    p === "error" ||
    p === "failed" ||
    p === "failure" ||
    p === "cancelled"
  ) {
    return "error";
  }
  if (isWaitingUserSignal(label, phaseOrStatus)) return "wait";
  if (isRunningActivityStatus(phaseOrStatus)) return "running";
  if (/失败|错误|异常|error|failed/i.test(label)) return "error";
  if (/成功|完成|success|done/i.test(label) && !/未完成|未成功/.test(label)) {
    return "success";
  }
  if (/正在|处理中|运行中|执行中|生成中|请求中|准备中|思考中/i.test(label)) {
    return "running";
  }
  return "neutral";
}

export function activityChipClass(tone: ActivityTone): string {
  const base = "chat-activity-chip";
  if (tone === "running") return `${base} chat-activity-chip--running`;
  if (tone === "wait") return `${base} chat-activity-chip--wait`;
  if (tone === "success") return `${base} chat-activity-chip--success`;
  if (tone === "error") return `${base} chat-activity-chip--error`;
  return base;
}

export function toolStatusTextClass(
  status?: "pending" | "running" | "success" | "error" | string,
): string {
  const tone = activityTone("", status);
  if (tone === "running") return "text-[var(--activity-running-fg)]";
  if (tone === "success") return "text-[var(--success-muted)]";
  if (tone === "error") return "text-[var(--danger-muted)]";
  return "text-[var(--fg-tertiary)]";
}
