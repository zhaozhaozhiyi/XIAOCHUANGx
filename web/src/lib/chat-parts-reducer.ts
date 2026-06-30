import type {
  ActivityCollapse,
  ChatPart,
  CommandPart,
  SkillPart,
  DocumentEditPart,
  DocumentReadPart,
  FileEditPart,
  FileReadPart,
  StatusPart,
  TodoPart,
  ToolPart,
  ClarificationPart,
} from "@/lib/chat-parts";
import {
  compactToolParts,
  formatDurationMs,
} from "@/lib/chat-parts-normalize";
import { isWaitingUserSignal } from "@/lib/chat-history";
import {
  orchestrationStatusLabel,
  type RunStartedPayload,
} from "@/lib/chat-run-started";
import { newPartId, normalizeMarkdown } from "@/lib/chat-parts-utils";

export type AssistantPartsState = {
  parts: ChatPart[];
  activityCollapse: ActivityCollapse;
  runId?: string;
  runStartedAt?: number;
  /** 单调递增，保证 part 按实际 SSE 到达顺序排序 */
  nextStreamSeq: number;
  /** tool / 进度文案之后，下一段 token 必须新开 text part（Hermes _freshSegment） */
  pendingNewTextSegment: boolean;
};

export function initAssistantPartsState(): AssistantPartsState {
  return {
    parts: [],
    activityCollapse: "expanded",
    nextStreamSeq: 0,
    pendingNewTextSegment: false,
  };
}

function bumpStreamSeq(state: AssistantPartsState): {
  seq: number;
  nextStreamSeq: number;
} {
  const seq = state.nextStreamSeq;
  return { seq, nextStreamSeq: seq + 1 };
}

function withStreamSeq(part: ChatPart, seq: number): ChatPart {
  return { ...part, streamSeq: seq };
}

const SINGLETON_SUMMARY_PART_KINDS = new Set<string>([
  "writing_requirements",
  "writing_requirement_summary",
  "writing_outline",
  "ppt_requirements",
  "ppt_requirement_summary",
  "ppt_outline",
  "3d_requirements",
  "3d_requirement_summary",
  "3d_outline",
  "video_requirements",
  "video_requirement_summary",
  "video_outline",
]);

function findRepeatablePartIndex(parts: ChatPart[], part: ChatPart): number {
  if (
    part.kind !== "deliverables" &&
    !SINGLETON_SUMMARY_PART_KINDS.has(part.kind)
  ) {
    return -1;
  }
  for (let idx = parts.length - 1; idx >= 0; idx -= 1) {
    if (parts[idx]?.kind === part.kind) return idx;
  }
  return -1;
}

function mergeRepeatedPart(existing: ChatPart, incoming: ChatPart): ChatPart {
  const streamSeq = existing.streamSeq ?? incoming.streamSeq;
  if (existing.kind === "deliverables" && incoming.kind === "deliverables") {
    const itemsByPath = new Map<string, (typeof incoming.items)[number]>();
    for (const item of existing.items) itemsByPath.set(item.path, item);
    for (const item of incoming.items) itemsByPath.set(item.path, item);
    return {
      ...incoming,
      headline: incoming.headline ?? existing.headline,
      primaryPath: incoming.primaryPath ?? existing.primaryPath,
      workspaceProjectId:
        incoming.workspaceProjectId ?? existing.workspaceProjectId,
      items: Array.from(itemsByPath.values()),
      streamSeq,
    };
  }
  return { ...incoming, streamSeq };
}

/** 新开 activity 前封存尾部流式块，避免正文占位后工具只能排在后面 */
function sealStreamingTail(parts: ChatPart[]): ChatPart[] {
  const last = parts[parts.length - 1];
  if (!last?.streaming) return parts;
  if (
    last.kind === "text" ||
    last.kind === "summary" ||
    last.kind === "reasoning" ||
    last.kind === "narration"
  ) {
    const next = [...parts];
    next[next.length - 1] = {
      ...last,
      streaming: false,
      completedAt: last.completedAt ?? Date.now(),
    };
    return next;
  }
  return parts;
}

function withSegmentBoundary(state: AssistantPartsState): AssistantPartsState {
  return { ...state, pendingNewTextSegment: true };
}

function isReasoningPlaceholderChunk(chunk: string): boolean {
  return chunk === "思考中";
}

function mergeReasoningMarkdown(current: string, chunk: string): string {
  if (!chunk || isReasoningPlaceholderChunk(chunk)) return current;
  if (!current || isReasoningPlaceholderChunk(current)) return chunk;
  if (chunk === current || current.endsWith(chunk)) return current;
  if (chunk.startsWith(current)) return chunk;

  const overlapMax = Math.min(current.length, chunk.length);
  for (let overlap = overlapMax; overlap > 0; overlap -= 1) {
    if (current.slice(-overlap) === chunk.slice(0, overlap)) {
      return `${current}${chunk.slice(overlap)}`;
    }
  }

  return `${current}${chunk}`;
}

function forcesNewTextSegment(last: ChatPart | undefined): boolean {
  if (!last) return false;
  if (last.kind === "tool" || last.kind === "command") return true;
  if (
    last.kind === "file_read" ||
    last.kind === "file_edit" ||
    last.kind === "document_read" ||
    last.kind === "document_edit"
  ) {
    return true;
  }
  if (last.kind === "narration" && !last.streaming) return true;
  return false;
}

function summaryContentFromParts(parts: ChatPart[]): string {
  return parts
    .filter(
      (p): p is Extract<ChatPart, { kind: "text" | "summary" }> =>
        p.kind === "text" || p.kind === "summary",
    )
    .map((p) => p.markdown)
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function findTextPart(parts: ChatPart[]): ChatPart | undefined {
  return parts.find((p) => p.kind === "text" || p.kind === "summary");
}

function findRunningTool(
  parts: ChatPart[],
  tool: string,
): ToolPart | undefined {
  const matches = parts.filter(
    (p): p is ToolPart =>
      p.kind === "tool" && p.tool === tool && p.status === "running",
  );
  return matches[matches.length - 1];
}

function upsertTurnMeta(
  parts: ChatPart[],
  patch: { durationMs?: number; runStatus?: "running" | "complete" | "waiting_user" | "cancelled" },
): ChatPart[] {
  const idx = parts.findIndex((p) => p.kind === "turn_meta");
  const existing = idx >= 0 ? parts[idx] : undefined;
  const label =
    patch.durationMs !== undefined
      ? `已处理 ${formatDurationMs(patch.durationMs)}`
      : "处理中…";
  const meta = {
    id: idx >= 0 ? parts[idx]!.id : newPartId("turn_meta"),
    zone: "activity" as const,
    kind: "turn_meta" as const,
    label,
    durationMs: patch.durationMs,
    runStatus: patch.runStatus ?? "running",
    streamSeq: existing?.streamSeq,
    streaming: patch.runStatus === "running",
    completedAt: patch.runStatus === "running" ? undefined : Date.now(),
  };
  if (idx >= 0) {
    const next = [...parts];
    next[idx] = meta;
    return next;
  }
  return [meta, ...parts];
}

export function reduceRunStarted(
  state: AssistantPartsState,
  info?: string | RunStartedPayload,
): AssistantPartsState {
  const payload: RunStartedPayload =
    typeof info === "string"
      ? { runId: info }
      : info ?? { runId: state.runId ?? `run-${Date.now()}` };

  const runStartedAt = Date.now();
  let nextStreamSeq = state.nextStreamSeq;
  const existingMeta = state.parts.find((p) => p.kind === "turn_meta");
  const metaSeq = existingMeta?.streamSeq ?? nextStreamSeq++;
  let parts = upsertTurnMeta(state.parts, { runStatus: "running" }).map((p) =>
    p.kind === "turn_meta" ? withStreamSeq(p, metaSeq) : p,
  );

  const slug = payload.baseProcessSkill ?? payload.processSkill;
  if (slug || payload.orchestrationMode) {
    parts = parts.filter(
      (p) => !(p.kind === "status" && p.label.startsWith("基座 ·")),
    );
    const statusSeq = metaSeq + 1;
    const statusPart: ChatPart = {
      id: newPartId("status"),
      zone: "activity",
      kind: "status",
      label: orchestrationStatusLabel(payload),
      phase: slug ?? payload.orchestrationMode ?? undefined,
      completedAt: Date.now(),
      streamSeq: statusSeq,
    };
    const metaIdx = parts.findIndex((p) => p.kind === "turn_meta");
    if (metaIdx >= 0) {
      parts = [
        ...parts.slice(0, metaIdx + 1),
        statusPart,
        ...parts.slice(metaIdx + 1),
      ];
    } else {
      parts = [statusPart, ...parts];
    }
    nextStreamSeq = Math.max(nextStreamSeq, statusSeq + 1);
  }

  return {
    ...state,
    runId: payload.runId,
    runStartedAt,
    activityCollapse: "expanded",
    pendingNewTextSegment: false,
    parts,
    nextStreamSeq,
  };
}

export function reduceAppendPart(
  state: AssistantPartsState,
  part: ChatPart,
): AssistantPartsState {
  const { seq, nextStreamSeq } = bumpStreamSeq(state);
  const sealedParts = sealStreamingTail(state.parts);
  const incoming = withStreamSeq(part, seq);
  const repeatedIdx = findRepeatablePartIndex(sealedParts, incoming);
  if (repeatedIdx >= 0) {
    const nextParts = [...sealedParts];
    nextParts[repeatedIdx] = mergeRepeatedPart(
      sealedParts[repeatedIdx]!,
      incoming,
    );
    return {
      ...state,
      nextStreamSeq,
      parts: nextParts,
    };
  }
  return {
    ...state,
    nextStreamSeq,
    parts: [...sealedParts, incoming],
  };
}

export function reduceTextDelta(
  state: AssistantPartsState,
  delta: string,
): AssistantPartsState {
  if (!delta) return state;
  let parts = [...state.parts];
  const last = parts[parts.length - 1];
  const mustNewSegment =
    state.pendingNewTextSegment || forcesNewTextSegment(last);

  if (
    !mustNewSegment &&
    last &&
    (last.kind === "text" || last.kind === "summary")
  ) {
    const merged = last.markdown + delta;
    parts[parts.length - 1] = {
      ...last,
      kind: "text",
      zone: "summary",
      markdown: !last.markdown ? normalizeMarkdown(merged) : merged,
      streaming: true,
    };
    return { ...state, parts, pendingNewTextSegment: false };
  }

  parts = sealStreamingTail(parts);
  const { seq, nextStreamSeq } = bumpStreamSeq({ ...state, parts });
  parts.push(
    withStreamSeq(
      {
        id: newPartId("text"),
        zone: "summary",
        kind: "text",
        markdown: normalizeMarkdown(delta),
        streaming: true,
      },
      seq,
    ),
  );
  return {
    ...state,
    parts,
    nextStreamSeq,
    pendingNewTextSegment: false,
  };
}

/** Hermes `interim_assistant`：工具之间的可见进度说明 */
export function reduceInterimAssistant(
  state: AssistantPartsState,
  payload: { text: string; alreadyStreamed?: boolean },
): AssistantPartsState {
  const parts = sealStreamingTail([...state.parts]);

  if (payload.alreadyStreamed) {
    return withSegmentBoundary({ ...state, parts });
  }

  const trimmed = normalizeMarkdown(payload.text);
  if (!trimmed) {
    return withSegmentBoundary({ ...state, parts });
  }

  const { seq, nextStreamSeq } = bumpStreamSeq({ ...state, parts });
  return withSegmentBoundary({
    ...state,
    nextStreamSeq,
    parts: [
      ...parts,
      withStreamSeq(
        {
          id: newPartId("narration"),
          zone: "activity",
          kind: "narration",
          markdown: trimmed,
          streaming: false,
          completedAt: Date.now(),
        },
        seq,
      ),
    ],
  });
}

function appendActivityPart(
  state: AssistantPartsState,
  part:
    | Omit<SkillPart, "streamSeq">
    | Omit<FileReadPart, "streamSeq">
    | Omit<DocumentReadPart, "streamSeq">
    | Omit<FileEditPart, "streamSeq">
    | Omit<DocumentEditPart, "streamSeq">
    | Omit<CommandPart, "streamSeq">
    | Omit<StatusPart, "streamSeq">
    | Omit<TodoPart, "streamSeq">,
): AssistantPartsState {
  const { seq, nextStreamSeq } = bumpStreamSeq(state);
  return {
    ...state,
    nextStreamSeq,
    parts: [
      ...sealStreamingTail(state.parts),
      withStreamSeq(part as ChatPart, seq),
    ],
  };
}

function addNarration(
  state: AssistantPartsState,
  markdown: string,
): AssistantPartsState {
  const trimmed = normalizeMarkdown(markdown);
  if (!trimmed) return state;
  const parts = [...sealStreamingTail(state.parts)];
  const { seq, nextStreamSeq } = bumpStreamSeq(state);
  parts.push(
    withStreamSeq(
      {
        id: newPartId("narration"),
        zone: "activity",
        kind: "narration",
        markdown: trimmed,
        streaming: true,
      } as ChatPart,
      seq,
    ),
  );
  return withSegmentBoundary({ ...state, parts, nextStreamSeq });
}

function addFileRead(
  state: AssistantPartsState,
  path: string,
): AssistantPartsState {
  const next = isDocumentPath(path)
    ? appendActivityPart(state, {
        id: newPartId("document_read"),
        zone: "activity",
        kind: "document_read",
        path,
        docType: detectDocumentType(path),
        completedAt: Date.now(),
      })
    : appendActivityPart(state, {
        id: newPartId("file_read"),
        zone: "activity",
        kind: "file_read",
        path,
        completedAt: Date.now(),
      });
  return withSegmentBoundary(next);
}

const COMMAND_TOOLS = new Set(["Bash", "bash", "run_terminal", "shell"]);

function isCommandTool(tool: string): boolean {
  return COMMAND_TOOLS.has(tool);
}

function addCommand(
  state: AssistantPartsState,
  command: string,
  status: ToolPart["status"],
): AssistantPartsState {
  const parts = [...sealStreamingTail(state.parts)];
  const running = parts.find(
    (p): p is Extract<ChatPart, { kind: "command" }> =>
      p.kind === "command" && !!p.streaming,
  );
  if (running && status !== "running") {
    const idx = parts.indexOf(running);
    parts[idx] = {
      ...running,
      command,
      streaming: false,
      completedAt: Date.now(),
    };
    return { ...state, parts };
  }
  if (!running || status === "running") {
    return withSegmentBoundary(
      appendActivityPart(
        { ...state, parts },
        {
          id: newPartId("command"),
          zone: "activity",
          kind: "command",
          command,
          streaming: status === "running",
          completedAt: status === "running" ? undefined : Date.now(),
        },
      ),
    );
  }
  return { ...state, parts };
}

function addFileEdit(
  state: AssistantPartsState,
  path: string,
  counts?: { additions?: number; deletions?: number },
): AssistantPartsState {
  const next = isDocumentPath(path)
    ? appendActivityPart(state, {
        id: newPartId("document_edit"),
        zone: "activity",
        kind: "document_edit",
        path,
        docType: detectDocumentType(path),
        additions: counts?.additions,
        deletions: counts?.deletions,
        completedAt: Date.now(),
      })
    : appendActivityPart(state, {
        id: newPartId("file_edit"),
        zone: "activity",
        kind: "file_edit",
        path,
        additions: counts?.additions,
        deletions: counts?.deletions,
        completedAt: Date.now(),
      });
  return withSegmentBoundary(next);
}

function isDocumentPath(path: string): boolean {
  return /\.(pdf|docx|pptx|ppt|html|md)$/i.test(path);
}

function detectDocumentType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".pdf")) return "PDF";
  if (lower.endsWith(".docx")) return "DOCX";
  if (lower.endsWith(".pptx") || lower.endsWith(".ppt")) return "PPT";
  if (lower.endsWith(".html")) return "HTML";
  if (lower.endsWith(".md")) return "Markdown";
  return "文档";
}

function skillLabel(slug: string): string {
  return slug.replace(/^skill-/, "").replace(/-/g, " ");
}

function addSkill(
  state: AssistantPartsState,
  slug: string,
  role: "process" | "platform" | "catalog" | "injected" = "process",
): AssistantPartsState {
  const trimmed = slug.trim();
  if (!trimmed) return state;
  const exists = state.parts.some(
    (part) => part.kind === "skill" && part.slug === trimmed && part.role === role,
  );
  if (exists) return state;
  return appendActivityPart(state, {
    id: newPartId("skill"),
    zone: "activity",
    kind: "skill",
    slug: trimmed,
    label: skillLabel(trimmed),
    role,
    completedAt: Date.now(),
  });
}

export function reduceToolProgress(
  state: AssistantPartsState,
  payload: {
    tool: string;
    status?: string;
    message?: string;
    callId?: string;
    input?: unknown;
    output?: unknown;
  },
): AssistantPartsState {
  if (payload.tool === "narration") {
    return addNarration(state, payload.message ?? "");
  }
  if (payload.tool === "phase") {
    return reduceStatusLabel(state, payload.message ?? "阶段", payload.status);
  }
  if (payload.tool === "reasoning") {
    const parts = [...sealStreamingTail(state.parts)];
    const last = parts[parts.length - 1];
    const chunk = payload.message ?? "思考中";
    const streaming = payload.status === "running";

    if (last?.kind === "reasoning") {
      parts[parts.length - 1] = {
        ...last,
        markdown: mergeReasoningMarkdown(last.markdown, chunk),
        streaming,
        completedAt: streaming ? undefined : Date.now(),
      };
      return streaming ? { ...state, parts } : withSegmentBoundary({ ...state, parts });
    }

    if (isReasoningPlaceholderChunk(chunk)) {
      return state;
    }

    const { seq, nextStreamSeq } = bumpStreamSeq(state);
    parts.push(
      withStreamSeq(
        {
          id: newPartId("reasoning"),
          zone: "activity",
          kind: "reasoning",
          markdown: chunk,
          streaming,
        },
        seq,
      ),
    );
    return { ...state, parts, nextStreamSeq };
  }

  if (
    payload.tool === "read_file" ||
    payload.tool === "Read" ||
    payload.tool === "read"
  ) {
    return addFileRead(state, payload.message ?? "file");
  }
  if (
    payload.tool === "write_file" ||
    payload.tool === "edit_file" ||
    payload.tool === "Write" ||
    payload.tool === "create_file"
  ) {
    const path = payload.message ?? "output.md";
    return addFileEdit(state, path);
  }

  if (isCommandTool(payload.tool)) {
    const cmd = payload.message ?? payload.tool;
    const status = normalizeToolStatus(payload.status);
    const withCmd = addCommand(state, cmd, status);
    const parts = [...sealStreamingTail(withCmd.parts)];
    const normalizedStatus = status;
    const running = payload.callId
      ? parts.find(
          (p): p is ToolPart =>
            p.kind === "tool" &&
            p.callId === payload.callId &&
            p.status === "running",
        )
      : findRunningTool(parts, payload.tool);
    if (running && normalizedStatus !== "running") {
      const idx = parts.indexOf(running);
      parts[idx] = {
        ...running,
        status: normalizedStatus,
        message: payload.message ?? running.message,
        input: payload.input ?? running.input,
        output: payload.output ?? running.output,
        streaming: false,
        completedAt: Date.now(),
      };
    } else if (!running || normalizedStatus === "running") {
      const { seq, nextStreamSeq } = bumpStreamSeq(withCmd);
      parts.push(
        withStreamSeq(
          {
            id: newPartId("tool"),
            zone: "activity",
            kind: "tool",
            tool: payload.tool,
            status: normalizedStatus,
            message: payload.message,
            callId: payload.callId,
            input: payload.input,
            output: payload.output,
            streaming: normalizedStatus === "running",
          },
          seq,
        ),
      );
      return withSegmentBoundary({
        ...withCmd,
        nextStreamSeq,
        parts,
      });
    }
    return { ...withCmd, parts };
  }

  let nextStreamSeq = state.nextStreamSeq;
  const parts = [...sealStreamingTail(state.parts)];
  const normalizedStatus = normalizeToolStatus(payload.status);
  const running = payload.callId
    ? parts.find(
        (p): p is ToolPart =>
          p.kind === "tool" &&
          p.callId === payload.callId &&
          p.status === "running",
      )
    : findRunningTool(parts, payload.tool);

  if (running && normalizedStatus !== "running") {
    const idx = parts.indexOf(running);
    parts[idx] = {
      ...running,
      status: normalizedStatus,
      message: payload.message ?? running.message,
      input: payload.input ?? running.input,
      output: payload.output ?? running.output,
      streaming: false,
      completedAt: Date.now(),
    };
  } else if (!running || normalizedStatus === "running") {
    const bumped = bumpStreamSeq({ ...state, parts, nextStreamSeq });
    nextStreamSeq = bumped.nextStreamSeq;
    parts.push(
      withStreamSeq(
        {
          id: newPartId("tool"),
          zone: "activity",
          kind: "tool",
          tool: payload.tool,
          status: normalizedStatus,
          message: payload.message,
          callId: payload.callId,
          input: payload.input,
          output: payload.output,
          streaming: normalizedStatus === "running",
        },
        bumped.seq,
      ),
    );
    return withSegmentBoundary({
      ...state,
      nextStreamSeq,
      parts,
    });
  }

  return {
    ...state,
    nextStreamSeq,
    parts,
  };
}

export function reducePartPatch(
  state: AssistantPartsState,
  patch: { id: string; merge: Record<string, unknown> },
): AssistantPartsState {
  const parts = state.parts.map((p) =>
    p.id === patch.id ? ({ ...p, ...patch.merge } as ChatPart) : p,
  );
  return { ...state, parts };
}

function normalizeToolStatus(
  status?: string,
): ToolPart["status"] {
  if (status === "pending" || status === "success" || status === "error") {
    return status;
  }
  if (status === "completed" || status === "complete") return "success";
  if (status === "failed") return "error";
  return "running";
}

export function reduceStatusLabel(
  state: AssistantPartsState,
  label: string,
  phase?: string,
): AssistantPartsState {
  const waitingUser = isWaitingUserSignal(label, phase);
  const shouldResumeRunning =
    !waitingUser &&
    state.parts.some(
      (part) => part.kind === "turn_meta" && part.runStatus === "waiting_user",
    );

  const parts =
    waitingUser || shouldResumeRunning
      ? upsertTurnMeta(state.parts, {
          durationMs: state.runStartedAt
            ? Date.now() - state.runStartedAt
            : undefined,
          runStatus: waitingUser ? "waiting_user" : "running",
        })
      : state.parts;

  return appendActivityPart({ ...state, parts }, {
    id: newPartId("status"),
    zone: "activity",
    kind: "status",
    label,
    phase,
    completedAt: Date.now(),
  });
}

export function reduceRunSkills(
  state: AssistantPartsState,
  input: {
    processSkill?: string | null;
    platformNormSkill?: string | null;
    catalogSlugs?: string[] | null;
    injectedSkills?: string[] | null;
  },
): AssistantPartsState {
  let next = state;
  if (input.platformNormSkill) {
    next = addSkill(next, input.platformNormSkill, "platform");
  }
  if (input.processSkill) {
    next = addSkill(next, input.processSkill, "process");
  }
  for (const slug of input.catalogSlugs ?? []) {
    next = addSkill(next, slug, "catalog");
  }
  for (const slug of input.injectedSkills ?? []) {
    next = addSkill(next, slug, "injected");
  }
  return next;
}

export function reduceTodoItems(
  state: AssistantPartsState,
  items: Array<{
    id: string;
    content: string;
    status: "pending" | "in_progress" | "completed" | "cancelled";
  }>,
): AssistantPartsState {
  const existing = state.parts.find((p) => p.kind === "todo");
  if (existing && existing.kind === "todo") {
    return {
      ...state,
      parts: state.parts.map((p) =>
        p.id === existing.id ? { ...existing, items } : p,
      ),
    };
  }
  return appendActivityPart(state, {
    id: newPartId("todo"),
    zone: "activity",
    kind: "todo",
    items,
    completedAt: Date.now(),
  });
}

export function reduceClarificationRequired(
  state: AssistantPartsState,
  payload: {
    runId: string;
    clarificationId: string;
    toolUseId: string;
    question: string;
    questions: ClarificationPart["questions"];
  },
): AssistantPartsState {
  const parts = [...sealStreamingTail(state.parts)];
  const existing = parts.findIndex(
    (p) =>
      p.kind === "clarification" &&
      p.clarificationId === payload.clarificationId,
  );
  const part: ClarificationPart = {
    id:
      existing >= 0
        ? parts[existing]!.id
        : newPartId("clarification"),
    zone: "summary",
    kind: "clarification",
    runId: payload.runId,
    clarificationId: payload.clarificationId,
    toolUseId: payload.toolUseId,
    question: payload.question,
    questions: payload.questions,
    streaming: true,
  };
  if (existing >= 0) {
    parts[existing] = {
      ...part,
      streamSeq: parts[existing]!.streamSeq,
    };
    return {
      ...state,
      parts: upsertTurnMeta(parts, {
        durationMs: state.runStartedAt
          ? Date.now() - state.runStartedAt
          : undefined,
        runStatus: "waiting_user",
      }),
      pendingNewTextSegment: true,
    };
  }
  const { seq, nextStreamSeq } = bumpStreamSeq({ ...state, parts });
  parts.push(withStreamSeq(part, seq));
  return {
    ...state,
    nextStreamSeq,
    parts: upsertTurnMeta(parts, {
      durationMs: state.runStartedAt
        ? Date.now() - state.runStartedAt
        : undefined,
      runStatus: "waiting_user",
    }),
    pendingNewTextSegment: true,
  };
}

function finalizeParts(parts: ChatPart[], runStartedAt?: number): ChatPart[] {
  let next = compactToolParts(parts);
  if (runStartedAt) {
    const durationMs = Date.now() - runStartedAt;
    const cancelled = next.some(
      (p) => p.kind === "turn_meta" && p.runStatus === "cancelled",
    );
    next = upsertTurnMeta(next, {
      durationMs,
      runStatus: cancelled ? "cancelled" : "complete",
    });
  }
  return next;
}

export function reduceStreamFinished(
  state: AssistantPartsState,
): AssistantPartsState {
  const parts: ChatPart[] = state.parts.map((p) => {
    const completedAt = p.completedAt ?? Date.now();
    if (p.kind === "text") {
      return {
        id: p.id,
        zone: "summary",
        kind: "summary",
        markdown: normalizeMarkdown(p.markdown),
        streaming: false,
        completedAt,
      };
    }
    if (p.kind === "tool" && p.status === "running") {
      return {
        ...p,
        streaming: false,
        completedAt,
        status: "success",
      };
    }
    if (p.kind === "tool_batch") {
      return {
        ...p,
        streaming: false,
        completedAt,
        items: p.items.map((i) =>
          i.status === "running" ? { ...i, status: "success" as const } : i,
        ),
      };
    }
    if (p.kind === "narration") {
      return {
        ...p,
        streaming: false,
        completedAt,
      };
    }
    return { ...p, streaming: false, completedAt };
  });
  return {
    parts: finalizeParts(parts, state.runStartedAt),
    runId: state.runId,
    runStartedAt: state.runStartedAt,
    activityCollapse: "collapsed",
    nextStreamSeq: state.nextStreamSeq,
    pendingNewTextSegment: false,
  };
}

export function reduceStreamError(
  state: AssistantPartsState,
  message: string,
  code?: string,
): AssistantPartsState {
  const parts = finalizeParts(
    [
      ...state.parts.map((p) => ({
        ...p,
        streaming: false,
        completedAt: p.completedAt ?? Date.now(),
      })),
      {
        id: newPartId("error"),
        zone: "activity",
        kind: "error",
        message,
        code,
        completedAt: Date.now(),
      },
    ],
    state.runStartedAt,
  );
  return {
    ...state,
    parts: upsertTurnMeta(parts, {
      durationMs: state.runStartedAt
        ? Date.now() - state.runStartedAt
        : undefined,
      runStatus: "complete",
    }),
    activityCollapse: "expanded",
    nextStreamSeq: state.nextStreamSeq + 1,
  };
}

export function reduceStreamCancelled(
  state: AssistantPartsState,
): AssistantPartsState {
  const finished = reduceStreamFinished({
    ...state,
    parts: upsertTurnMeta(state.parts, {
      durationMs: state.runStartedAt
        ? Date.now() - state.runStartedAt
        : undefined,
      runStatus: "cancelled",
    }),
  });
  const text = findTextPart(finished.parts);
  if (text && (text.kind === "summary" || text.kind === "text")) {
    const parts = finished.parts.map((p) =>
      p.id === text.id
        ? {
            ...text,
            markdown: text.markdown.trim()
              ? `${text.markdown.trim()}\n\n（已中断）`
              : "（已中断）",
          }
        : p,
    );
    return { ...finished, parts, activityCollapse: "expanded" };
  }
  return {
    ...finished,
    parts: [
      ...finished.parts,
      {
        id: newPartId("summary"),
        zone: "summary",
        kind: "summary",
        markdown: "（已中断）",
        completedAt: Date.now(),
      },
    ],
    activityCollapse: "expanded",
  };
}

export function toggleActivityCollapse(
  state: AssistantPartsState,
  expand: boolean,
): AssistantPartsState {
  return {
    ...state,
    activityCollapse: expand ? "user_expanded" : "user_collapsed",
  };
}

export function applyPartsStateToMessage<
  T extends {
    parts?: ChatPart[];
    activityCollapse?: ActivityCollapse;
    runId?: string;
    content: string;
    status?: string;
  },
>(
  msg: T,
  state: AssistantPartsState,
  options?: { syncContent?: boolean },
): T {
  const textPart = findTextPart(state.parts);
  const merged = summaryContentFromParts(state.parts);
  const content = merged || (
    textPart && (textPart.kind === "text" || textPart.kind === "summary")
      ? textPart.markdown
      : msg.content
  );
  const next = {
    ...msg,
    parts: state.parts,
    activityCollapse: state.activityCollapse,
    runId: state.runId,
    runStartedAt: state.runStartedAt,
  };
  return options?.syncContent === false ? next : { ...next, content };
}
