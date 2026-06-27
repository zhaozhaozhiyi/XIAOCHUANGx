import { buildLaunchSpec } from "../agents/build-args.js";
import { createBaseAdapter } from "./shared.js";

export const kiroAdapter = createBaseAdapter({
  agentId: "kiro",
  createLaunchSpec: (ctx) => buildLaunchSpec("kiro", ctx),
  createParser: () => ({
    feed() {},
    flush() {},
  }),
});
