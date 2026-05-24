import {
  appendSessionMessages,
  loadSessionMessages,
  saveSessionMessages,
  type StoredChatMessage,
} from "../sessions/store.js";
import type { CanonicalTurnOutput } from "@jlc/contracts";
import type { CreateRunRequest } from "../types.js";
import type { RunEventWriter } from "./sse.js";

type BackgroundRunState = {
  userMessageId: string;
  assistantMessageId: string;
  userContent: string;
  assistantContent: string;
  assistantStatus:
    | "loading"
    | "streaming"
    | "complete"
    | "error"
    | "cancelled";
  runStartedAt: number;
  lastUpdatedAt: number;
  canonicalOutput?: CanonicalTurnOutput;
};

function messageId(prefix: "user" | "assistant", runId: string): string {
  return `${prefix}-${runId}`;
}

function findLastUserMessage(req: CreateRunRequest): string {
  return [...req.messages].reverse().find((m) => m.role === "user")?.content ?? "";
}

function buildUserMessage(state: BackgroundRunState): StoredChatMessage {
  return {
    id: state.userMessageId,
    role: "user",
    content: state.userContent,
    status: "complete",
  };
}

function buildAssistantMessage(
  runId: string,
  state: BackgroundRunState,
): StoredChatMessage {
  return {
    id: state.assistantMessageId,
    role: "assistant",
    content: state.assistantContent,
    status: state.assistantStatus,
    runId,
    runStartedAt: state.runStartedAt,
    canonicalOutput: state.canonicalOutput,
  };
}

async function upsertSessionMessages(
  req: CreateRunRequest,
  runId: string,
  state: BackgroundRunState,
): Promise<void> {
  const existing = await loadSessionMessages(req.sessionId);
  const persisted = existing?.messages ?? [];
  const filtered = persisted.filter(
    (item) =>
      item.id !== state.userMessageId && item.id !== state.assistantMessageId,
  );
  filtered.push(buildUserMessage(state));
  filtered.push(buildAssistantMessage(runId, state));
  await saveSessionMessages(req.sessionId, filtered, req.projectId);
}

export async function primeSessionForRun(
  req: CreateRunRequest,
  runId: string,
): Promise<BackgroundRunState> {
  const userContent = findLastUserMessage(req);
  const state: BackgroundRunState = {
    userMessageId: messageId("user", runId),
    assistantMessageId: messageId("assistant", runId),
    userContent,
    assistantContent: "",
    assistantStatus: "streaming",
    runStartedAt: Date.now(),
    lastUpdatedAt: Date.now(),
  };
  await appendSessionMessages(
    req.sessionId,
    [buildUserMessage(state), buildAssistantMessage(runId, state)],
    req.projectId,
  );
  return state;
}

export async function appendAssistantDelta(
  req: CreateRunRequest,
  runId: string,
  state: BackgroundRunState,
  chunk: string,
): Promise<void> {
  if (!chunk) return;
  state.assistantContent += chunk;
  state.assistantStatus = "streaming";
  state.lastUpdatedAt = Date.now();
  await upsertSessionMessages(req, runId, state);
}

export async function markAssistantFinished(
  req: CreateRunRequest,
  runId: string,
  state: BackgroundRunState,
  status: "complete" | "error" | "cancelled",
  canonicalOutput?: CanonicalTurnOutput,
  fallbackMessage?: string,
): Promise<void> {
  if (!state.assistantContent.trim() && fallbackMessage?.trim()) {
    state.assistantContent = fallbackMessage.trim();
  }
  state.assistantStatus = status;
  state.lastUpdatedAt = Date.now();
  if (canonicalOutput) {
    state.canonicalOutput = canonicalOutput;
    if (!state.assistantContent.trim() && canonicalOutput.finalAnswer.markdown.trim()) {
      state.assistantContent = canonicalOutput.finalAnswer.markdown.trim();
    }
  }
  await upsertSessionMessages(req, runId, state);
}

export function createPersistedRunWriter(
  req: CreateRunRequest,
  runId: string,
  baseWriter: RunEventWriter,
): RunEventWriter {
  let statePromise = primeSessionForRun(req, runId);
  let flushChain: Promise<void> = Promise.resolve();

  const schedule = (
    task: (state: BackgroundRunState) => Promise<void>,
  ): void => {
    flushChain = flushChain
      .then(async () => task(await statePromise))
      .catch(() => {});
  };

  return {
    send(event: string, data: unknown) {
      baseWriter.send(event, data);
      const payload =
        data && typeof data === "object"
          ? (data as Record<string, unknown>)
          : null;

      if (event === "message.delta") {
        const chunk =
          typeof payload?.content === "string"
            ? payload.content
            : typeof payload?.delta === "string"
              ? payload.delta
              : typeof payload?.text === "string"
                ? payload.text
                : "";
        if (chunk) {
          schedule((state) => appendAssistantDelta(req, runId, state, chunk));
        }
        return;
      }

      if (event === "run.finished") {
        schedule((state) =>
          markAssistantFinished(req, runId, state, "complete"),
        );
        return;
      }

      if (event === "canonical.output") {
        const output =
          payload?.canonicalOutput && typeof payload.canonicalOutput === "object"
            ? (payload.canonicalOutput as CanonicalTurnOutput)
            : undefined;
        if (output) {
          schedule(async (state) => {
            state.canonicalOutput = output;
            if (!state.assistantContent.trim() && output.finalAnswer.markdown.trim()) {
              state.assistantContent = output.finalAnswer.markdown.trim();
            }
            state.lastUpdatedAt = Date.now();
            await upsertSessionMessages(req, runId, state);
          });
        }
        return;
      }

      if (event === "run.cancelled") {
        schedule((state) =>
          markAssistantFinished(req, runId, state, "cancelled"),
        );
        return;
      }

      if (event === "run.error") {
        const message =
          typeof payload?.message === "string" ? payload.message : "";
        schedule((state) =>
          markAssistantFinished(req, runId, state, "error", undefined, message),
        );
      }
    },
    end() {
      baseWriter.end();
    },
    async flush() {
      await flushChain;
      await statePromise;
      await baseWriter.flush?.();
    },
  };
}

export type { BackgroundRunState };
