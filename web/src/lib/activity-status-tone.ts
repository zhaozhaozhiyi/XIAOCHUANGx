import { isWaitingUserSignal } from "@/lib/chat-history";

export type ActivityTone = "neutral" | "wait" | "success" | "error";

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
  if (/失败|错误|异常|error|failed/i.test(label)) return "error";
  if (/成功|完成|success|done/i.test(label) && !/未完成|未成功/.test(label)) {
    return "success";
  }
  return "neutral";
}

export function activityChipClass(tone: ActivityTone): string {
  const base = "chat-activity-chip";
  if (tone === "wait") return `${base} chat-activity-chip--wait`;
  if (tone === "success") return `${base} chat-activity-chip--success`;
  if (tone === "error") return `${base} chat-activity-chip--error`;
  return base;
}

export function toolStatusTextClass(
  status?: "pending" | "running" | "success" | "error" | string,
): string {
  const tone = activityTone("", status);
  if (tone === "success") return "text-[var(--success-muted)]";
  if (tone === "error") return "text-[var(--danger-muted)]";
  if (status === "running") return "text-[var(--fg-secondary)]";
  return "text-[var(--fg-tertiary)]";
}
