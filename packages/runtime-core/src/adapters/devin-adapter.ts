import { buildLaunchSpec } from "../agents/build-args.js";
import { createBaseAdapter } from "./shared.js";

export const devinAdapter = createBaseAdapter({
  agentId: "devin",
  createLaunchSpec: (ctx) => buildLaunchSpec("devin", ctx),
  createParser: () => ({
    feed() {},
    flush() {},
  }),
});
