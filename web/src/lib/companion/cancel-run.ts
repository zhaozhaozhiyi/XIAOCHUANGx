import { controlCompanionRun } from "@/lib/companion/control-run";

/** 通知 Companion 中断正在执行的 Run（与 abort fetch 并用，确保 CLI 子进程退出） */
export async function cancelCompanionRun(runId: string): Promise<void> {
  if (!runId.trim()) return;
  try {
    await controlCompanionRun({
      runId,
      action: "interrupt",
      text: "",
    });
  } catch {
    /* 网络失败时仍依赖 fetch abort 断开 SSE */
  }
}
