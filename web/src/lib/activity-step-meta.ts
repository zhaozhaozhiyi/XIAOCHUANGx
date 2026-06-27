import type { ChatPart } from "@/lib/chat-parts";

export type ActivityStepIcon = "reasoning" | "run" | "file" | "batch" | "other";

export type ActivityStepMeta = {
  icon: ActivityStepIcon;
  running: boolean;
  complete: boolean;
  ariaLabel: string;
  /** 时间线 episode 固定标题（如「思考过程」「运行」） */
  episodeLabel?: string;
};

function isRunning(part: ChatPart): boolean {
  if ("streaming" in part && part.streaming) return true;
  if (part.kind === "tool") return part.status === "running";
  if (part.kind === "tool_batch") return !!part.streaming;
  return false;
}

export function activityStepMeta(part: ChatPart): ActivityStepMeta {
  const running = isRunning(part);

  if (part.kind === "reasoning") {
    return {
      icon: "reasoning",
      running,
      complete: !running,
      ariaLabel: running ? "推理中" : "推理完成",
      episodeLabel: "思考过程",
    };
  }
  if (part.kind === "narration") {
    return {
      icon: "reasoning",
      running,
      complete: !running,
      ariaLabel: running ? "说明生成中" : "说明完成",
    };
  }
  if (
    part.kind === "command" ||
    part.kind === "tool" ||
    part.kind === "tool_batch"
  ) {
    const failed = part.kind === "tool" && part.status === "error";
    return {
      icon: part.kind === "tool_batch" ? "batch" : "run",
      running,
      complete: !running && !failed,
      ariaLabel: running ? "运行中" : failed ? "运行失败" : "运行完成",
      episodeLabel: "运行",
    };
  }
  if (
    part.kind === "file_read" ||
    part.kind === "file_edit" ||
    part.kind === "document_read" ||
    part.kind === "document_edit"
  ) {
    return {
      icon: "file",
      running: false,
      complete: true,
      ariaLabel: part.kind.includes("edit") ? "文件已修改" : "文件已读取",
    };
  }
  return {
    icon: "other",
    running,
    complete: !running,
    ariaLabel: "过程步骤",
  };
}
