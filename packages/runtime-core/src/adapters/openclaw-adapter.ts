import { buildLaunchSpec } from "../agents/build-args.js";
import { createPlainParser } from "../parsers/plain.js";
import { createBaseAdapter } from "./shared.js";

export const openclawAdapter = createBaseAdapter({
  agentId: "openclaw",
  createLaunchSpec: (ctx) => buildLaunchSpec("openclaw", ctx),
  createParser: (onEvent) => createPlainParser(onEvent),
});
