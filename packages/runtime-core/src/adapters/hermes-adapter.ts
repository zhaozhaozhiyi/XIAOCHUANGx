import { buildLaunchSpec } from "../agents/build-args.js";
import { createPlainParser } from "../parsers/plain.js";
import { createBaseAdapter } from "./shared.js";

export const hermesAdapter = createBaseAdapter({
  agentId: "hermes",
  createLaunchSpec: (ctx) => buildLaunchSpec("hermes", ctx),
  createParser: (onEvent) => createPlainParser(onEvent),
});
