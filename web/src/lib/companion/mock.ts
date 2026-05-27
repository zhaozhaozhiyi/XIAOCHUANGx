import { getMockActivityEvents, getMockReply } from "@/lib/chat";
import { buildDeliverablesPart } from "@/lib/mock-deliverables";
import { encodeMockActivitySse } from "@/lib/mock-activity-sse";
import type { ChatModeId } from "@/lib/navigation";
import { AGENT_FALLBACK_MODELS } from "@/lib/agent-catalog";
import { AGENT_IDS } from "@jlc/runtime-core/agent-catalog";
import { agentLabel, MOCK_CLI_STATES, type AgentId } from "@/lib/settings";
import type {
  CompanionAgentsResponse,
  CompanionHealthResponse,
  CreateRunRequest,
} from "@/lib/companion/types";
import { COMPANION_API_VERSION } from "@/lib/companion/types";

export function mockCompanionHealth(): CompanionHealthResponse {
  return {
    ok: true,
    version: "0.0.0-mock",
    apiVersion: COMPANION_API_VERSION,
    companionId: "mock-companion",
    dataDir: "~/.jlcresearch/companion",
  };
}

export function mockCompanionAgents(): CompanionAgentsResponse {
  return {
    inferenceChannel: "cli",
    defaultAgentId: "codex",
    agents: (AGENT_IDS as readonly AgentId[]).map((agentId) => {
      const s = MOCK_CLI_STATES[agentId];
      return {
        agentId,
        bin: agentId,
        status: s.status,
        version: s.version,
        hint: s.hint,
        path: s.status !== "not_installed" ? `/usr/local/bin/${agentId}` : undefined,
        models: AGENT_FALLBACK_MODELS[agentId],
        modelsSource: "fallback" as const,
      };
    }),
  };
}

/** Mock SSE: simulates Companion spawning the selected CLI. */
export function mockCompanionRunSse(
  req: CreateRunRequest,
  lastUser: string,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const mode = req.binding.moduleId === "chat" ? req.binding.mode : "fast";
  const text = getMockReply(lastUser, mode as ChatModeId, req.agentId);
  const cliName = agentLabel(req.agentId).replace(" CLI", "");
  const body = `【${cliName} · 本机 CLI Mock】\n\n${text}`;
  const parts = body.match(/[\s\S]{1,40}/g) ?? [body];
  const activity = getMockActivityEvents(mode as ChatModeId, lastUser);

  return new ReadableStream({
    async start(controller) {
      const runId = `mock-run-${Date.now()}`;
      controller.enqueue(
        encoder.encode(
          `event: run.accepted\ndata: ${JSON.stringify({
            runId,
            message: "正在准备 Mock 运行…",
          })}\n\n`,
        ),
      );
      await new Promise((r) => setTimeout(r, 40));
      controller.enqueue(
        encoder.encode(
          `event: run.started\ndata: ${JSON.stringify({
            runId,
            agentId: req.agentId,
            cwd: req.workspaceProjectId,
            processSkill: req.processSkill,
            baseProcessSkill: req.processSkill,
            orchestrationMode: "hybrid-steer",
            catalogVersion: "1",
            catalogSlugs: ["skill-ppt-deck", "skill-ppt-pitch-deck", "skill-ppt-html-studio"],
          })}\n\n`,
        ),
      );
      await new Promise((r) => setTimeout(r, 60));

      for (const ev of activity) {
        for (const chunk of encodeMockActivitySse(encoder, ev, "companion")) {
          controller.enqueue(chunk);
        }
        await new Promise((r) => setTimeout(r, 80));
      }

      const deliverablesPart = buildDeliverablesPart(
        mode as ChatModeId,
        lastUser,
      );
      if (deliverablesPart) {
        controller.enqueue(
          encoder.encode(
            `event: part.append\ndata: ${JSON.stringify({ part: deliverablesPart })}\n\n`,
          ),
        );
        await new Promise((r) => setTimeout(r, 60));
      }

      for (const part of parts) {
        controller.enqueue(
          encoder.encode(
            `event: message.delta\ndata: ${JSON.stringify({ content: part })}\n\n`,
          ),
        );
        await new Promise((r) => setTimeout(r, 35));
      }
      controller.enqueue(
        encoder.encode(
          `event: run.finished\ndata: ${JSON.stringify({ runId })}\n\n`,
        ),
      );
      controller.close();
    },
  });
}
