import { buildLaunchSpec } from "../agents/build-args.js";
import { createCodexJsonParser } from "../parsers/codex-json.js";
import { createBaseAdapter } from "./shared.js";

export const codexAdapter = createBaseAdapter({
  agentId: "codex",
  createLaunchSpec: (ctx) => buildLaunchSpec("codex", ctx),
  createParser: (onEvent) => createCodexJsonParser(onEvent),
  spawnOptions: ({ spec }) => (spec.requiresShell ? { shell: true } : {}),
});
