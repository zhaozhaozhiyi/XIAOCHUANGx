import { buildLaunchSpec } from "../agents/build-args.js";
import { createBaseAdapter } from "./shared.js";

export const kiloAdapter = createBaseAdapter({
  agentId: "kilo",
  createLaunchSpec: (ctx) => buildLaunchSpec("kilo", ctx),
  createParser: () => ({
    feed() {},
    flush() {},
  }),
});
