import { buildLaunchSpec } from "../agents/build-args.js";
import { createPlainParser } from "../parsers/plain.js";
import { createBaseAdapter } from "./shared.js";

export const deepseekAdapter = createBaseAdapter({
  agentId: "deepseek",
  createLaunchSpec: (ctx) => buildLaunchSpec("deepseek", ctx),
  createParser: (onEvent) => createPlainParser(onEvent),
});
