import { buildLaunchSpec } from "../agents/build-args.js";
import { createQoderStreamParser } from "../parsers/qoder-stream.js";
import { createBaseAdapter } from "./shared.js";

export const qoderAdapter = createBaseAdapter({
  agentId: "qoder",
  createLaunchSpec: (ctx) => buildLaunchSpec("qoder", ctx),
  createParser: (onEvent) => createQoderStreamParser(onEvent),
});
