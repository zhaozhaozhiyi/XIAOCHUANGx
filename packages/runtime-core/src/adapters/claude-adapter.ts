import { buildLaunchSpec } from "../agents/build-args.js";
import { createClaudeJsonlParser } from "../parsers/claude-jsonl.js";
import { createBaseAdapter } from "./shared.js";

export const claudeAdapter = createBaseAdapter({
  agentId: "claude",
  createLaunchSpec: (ctx) => buildLaunchSpec("claude", ctx),
  createParser: (onEvent) => createClaudeJsonlParser(onEvent),
});
