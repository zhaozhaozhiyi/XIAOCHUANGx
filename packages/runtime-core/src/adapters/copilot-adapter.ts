import { buildLaunchSpec } from "../agents/build-args.js";
import { createCopilotStreamParser } from "../parsers/copilot-stream.js";
import { createBaseAdapter } from "./shared.js";

export const copilotAdapter = createBaseAdapter({
  agentId: "copilot",
  createLaunchSpec: (ctx) => buildLaunchSpec("copilot", ctx),
  createParser: (onEvent) => createCopilotStreamParser(onEvent),
});
