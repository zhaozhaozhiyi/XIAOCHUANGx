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
    if (ev.delta) state.textEmitted = true;
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
