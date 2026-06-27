import { buildLaunchSpec } from "../agents/build-args.js";
import { createBaseAdapter } from "./shared.js";

export const vibeAdapter = createBaseAdapter({
  agentId: "vibe",
  createLaunchSpec: (ctx) => buildLaunchSpec("vibe", ctx),
  createParser: () => ({
    feed() {},
    flush() {},
  }),
});
