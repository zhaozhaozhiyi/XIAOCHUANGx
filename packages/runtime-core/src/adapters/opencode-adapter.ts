import { buildLaunchSpec } from "../agents/build-args.js";
import { createJsonEventStreamParser } from "../parsers/json-event-stream.js";
import { createBaseAdapter } from "./shared.js";

export const opencodeAdapter = createBaseAdapter({
  agentId: "opencode",
  createLaunchSpec: (ctx) => buildLaunchSpec("opencode", ctx),
  createParser: (onEvent) => createJsonEventStreamParser("opencode", onEvent),
});
