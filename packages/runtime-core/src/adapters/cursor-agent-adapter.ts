import { buildLaunchSpec } from "../agents/build-args.js";
import { createJsonEventStreamParser } from "../parsers/json-event-stream.js";
import { createBaseAdapter } from "./shared.js";

export const cursorAgentAdapter = createBaseAdapter({
  agentId: "cursor-agent",
  createLaunchSpec: (ctx) => buildLaunchSpec("cursor-agent", ctx),
  createParser: (onEvent) => createJsonEventStreamParser("cursor-agent", onEvent),
});
