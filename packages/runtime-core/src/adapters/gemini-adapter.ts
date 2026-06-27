import { buildLaunchSpec } from "../agents/build-args.js";
import { createJsonEventStreamParser } from "../parsers/json-event-stream.js";
import { createBaseAdapter } from "./shared.js";

export const geminiAdapter = createBaseAdapter({
  agentId: "gemini",
  createLaunchSpec: (ctx) => buildLaunchSpec("gemini", ctx),
  createParser: (onEvent) => createJsonEventStreamParser("gemini", onEvent),
  spawnOptions: () => ({
    env: { ...process.env, GEMINI_CLI_TRUST_WORKSPACE: "true" },
  }),
});
