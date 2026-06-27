import type { AgentAdapter } from "./types.js";

/**
 * New agent adapter template:
 * 1. define registry entry in agent-registry.ts
 * 2. create launch spec in agents/build-args.ts
 * 3. implement parser or reuse an existing parser
 * 4. register the adapter in adapters/index.ts
 */
export const templateAdapter: AgentAdapter = {
  agentId: "codex",
  createLaunchSpec() {
    throw new Error("implement createLaunchSpec for your new agent");
  },
  createParser() {
    return {
      feed() {},
      flush() {},
    };
  },
  stdinBody(input) {
    return input.composedPrompt;
  },
};
