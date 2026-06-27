import { buildLaunchSpec } from "../agents/build-args.js";
import { createBaseAdapter } from "./shared.js";

export const piAdapter = createBaseAdapter({
  agentId: "pi",
  createLaunchSpec: (ctx) => buildLaunchSpec("pi", ctx),
  createParser: () => ({
    feed() {},
    flush() {},
  }),
});
