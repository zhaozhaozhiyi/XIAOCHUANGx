import type { SpawnOptions } from "node:child_process";
import type {
  AgentLaunchSpec,
  BuildArgsContext,
} from "../agents/build-args.js";
import type {
  AgentId,
  AgentStreamEvent,
  RunAgentCallbacks,
  RunAgentInput,
  RunAgentResult,
} from "../types.js";

export type AgentParser = {
  feed: (chunk: string) => void;
  flush: () => void;
};

export type AgentAdapterContext = {
  input: RunAgentInput;
  buildArgs: BuildArgsContext;
  spec: AgentLaunchSpec;
};

export type AgentAdapterRuntimeState = {
  textEmitted: boolean;
  threadId?: string;
};

export type AgentAdapter = {
  agentId: AgentId;
  createLaunchSpec: (ctx: BuildArgsContext) => AgentLaunchSpec;
  createParser: (
    onEvent: (ev: AgentStreamEvent) => void,
  ) => AgentParser;
  stdinBody?: (input: RunAgentInput) => string;
  writeToStdin?: (input: {
    stdin: NodeJS.WritableStream;
    body: string;
    spec: AgentLaunchSpec;
    input: RunAgentInput;
  }) => void;
  spawnOptions?: (ctx: AgentAdapterContext) => Partial<SpawnOptions>;
  finalizeResult?: (
    state: AgentAdapterRuntimeState,
    base: Omit<RunAgentResult, "codexThreadId">,
  ) => RunAgentResult;
  onEvent?: (
    ev: AgentStreamEvent,
    state: AgentAdapterRuntimeState,
    callbacks: RunAgentCallbacks,
  ) => void;
};
