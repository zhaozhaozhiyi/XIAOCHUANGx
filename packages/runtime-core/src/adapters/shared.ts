import type { BuildArgsContext } from "../agents/build-args.js";
import type {
  AgentId,
  AgentStreamEvent,
  RunAgentCallbacks,
  RunAgentInput,
  RunAgentResult,
} from "../types.js";
import type {
  AgentAdapter,
  AgentAdapterRuntimeState,
  AgentParser,
} from "./types.js";

export function defaultStdinBody(input: RunAgentInput): string {
  return input.composedPrompt;
}

export function defaultOnEvent(
  ev: AgentStreamEvent,
  state: AgentAdapterRuntimeState,
  callbacks: RunAgentCallbacks,
): void {
  if (ev.type === "text_delta") {
    if (ev.delta) {
      state.textEmitted = true;
      state.hasFinalText = true;
    }
    callbacks.onText(ev.delta);
    return;
  }
  if (ev.type === "user_input_request") {
    callbacks.onUserInputRequest?.({
      toolUseId: ev.toolUseId,
      toolName: ev.toolName,
      input: ev.input,
      questions: ev.questions,
    });
    return;
  }
  if (ev.type === "tool_progress") {
    callbacks.onToolProgress?.({
      tool: ev.tool,
      status: ev.status,
      message: ev.message,
      callId: ev.callId,
      input: ev.input,
      output: ev.output,
    });
    return;
  }
  if (ev.type === "narration") {
    callbacks.onNarration?.(ev.text);
    return;
  }
  if (ev.type === "assistant_segment") {
    const hadFinalText = state.hasFinalText;
    const segment = state.assistantSegments.get(ev.segmentId) ?? {
      text: "",
      forwardedFinalLength: 0,
      forwardedProcessLength: 0,
    };
    if (ev.text) segment.text += ev.text;
    state.assistantSegments.set(ev.segmentId, segment);
    if (ev.role === "final" && segment.text) state.textEmitted = true;

    if (callbacks.onAssistantSegment) {
      if (ev.role === "final" && segment.text) state.hasFinalText = true;
      callbacks.onAssistantSegment(ev);
      return;
    }
    if (ev.role === "final") {
      const unforwarded = segment.text.slice(segment.forwardedFinalLength);
      if (unforwarded) {
        const startsNewSegment = segment.forwardedFinalLength === 0;
        callbacks.onText(
          `${startsNewSegment && hadFinalText ? "\n\n" : ""}${unforwarded}`,
        );
        segment.forwardedFinalLength = segment.text.length;
        state.hasFinalText = true;
      }
      return;
    }
    if (ev.role === "process") {
      const unforwarded = segment.text.slice(segment.forwardedProcessLength);
      if (unforwarded) {
        callbacks.onNarration?.(unforwarded);
        segment.forwardedProcessLength = segment.text.length;
      }
    }
    return;
  }
  if (ev.type === "thread_started") {
    state.threadId = ev.threadId;
    callbacks.onThreadStarted?.(ev.threadId);
    return;
  }
  if (ev.type === "error") {
    callbacks.onError?.(ev.message, ev.code);
  }
}

export function defaultWriteToStdin(input: {
  stdin: NodeJS.WritableStream;
  body: string;
  spec: { stdinAsClaudeUserMessage?: boolean; closeStdinAfterPrompt: boolean };
}): void {
  if (!input.body) return;
  if (input.spec.stdinAsClaudeUserMessage) {
    const line = JSON.stringify({
      type: "user",
      message: {
        role: "user",
        content: [{ type: "text", text: input.body }],
      },
    });
    input.stdin.write(`${line}\n`, "utf8");
    if (input.spec.closeStdinAfterPrompt) {
      input.stdin.end?.();
    }
    return;
  }
  input.stdin.write(input.body, "utf8");
  if (input.spec.closeStdinAfterPrompt) {
    input.stdin.end?.();
  }
}

export function defaultFinalizeResult(
  state: AgentAdapterRuntimeState,
  base: Omit<RunAgentResult, "codexThreadId">,
): RunAgentResult {
  return {
    ...base,
    codexThreadId: state.threadId,
  };
}

export function createBaseAdapter(input: {
  agentId: AgentId;
  createLaunchSpec: AgentAdapter["createLaunchSpec"];
  createParser: (onEvent: (ev: AgentStreamEvent) => void) => AgentParser;
  stdinBody?: AgentAdapter["stdinBody"];
  writeToStdin?: AgentAdapter["writeToStdin"];
  spawnOptions?: AgentAdapter["spawnOptions"];
  finalizeResult?: AgentAdapter["finalizeResult"];
  onEvent?: AgentAdapter["onEvent"];
}): AgentAdapter {
  return {
    agentId: input.agentId,
    createLaunchSpec: (ctx: BuildArgsContext) => input.createLaunchSpec(ctx),
    createParser: input.createParser,
    stdinBody: input.stdinBody ?? defaultStdinBody,
    writeToStdin: input.writeToStdin ?? defaultWriteToStdin,
    spawnOptions: input.spawnOptions,
    finalizeResult: input.finalizeResult ?? defaultFinalizeResult,
    onEvent: input.onEvent ?? defaultOnEvent,
  };
}
