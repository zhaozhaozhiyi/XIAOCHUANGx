import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMockAiUiFlow } from "../web/src/lib/mock-ai-ui-flow.ts";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function read(path: string): string {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

const contracts = read("packages/contracts/src/chat.ts");
const renderer = read("web/src/components/chat/parts/PartRenderer.tsx");
const summaryCard = read("web/src/components/chat/parts/RequirementSummaryCard.tsx");
const thread = read("web/src/components/chat/ChatThread.tsx");
const selectors = read("web/src/lib/chat-message-selectors.ts");

for (const kind of [
  "video_requirements",
  "video_requirement_summary",
  "video_outline",
]) {
  if (!contracts.includes(`"${kind}"`)) {
    throw new Error(`contracts missing ${kind}`);
  }
  if (!renderer.includes(`case "${kind}"`)) {
    throw new Error(`PartRenderer missing ${kind}`);
  }
  if (
    kind !== "video_requirement_summary" &&
    !thread.includes(`part.kind !== "${kind}"`) &&
    !thread.includes(`part.kind === "${kind}"`)
  ) {
    throw new Error(`ChatThread missing ${kind}`);
  }
  if (
    kind === "video_requirements" &&
    !selectors.includes(`part.kind === "${kind}"`)
  ) {
    throw new Error(`chat-message-selectors missing ${kind}`);
  }
}

for (const expected of ["VideoOutlineData", "视频需求摘要", "视频 outline"]) {
  if (!summaryCard.includes(expected)) {
    throw new Error(`RequirementSummaryCard missing video marker: ${expected}`);
  }
}

const firstTurn = buildMockAiUiFlow({
  moduleId: "video",
  lastUserText: "帮我做个介绍视频。",
});
if (!firstTurn?.stopAfterParts) {
  throw new Error("video first turn should stop after requirements");
}
if (firstTurn.parts[0]?.kind !== "video_requirements") {
  throw new Error(`expected video_requirements, got ${firstTurn.parts[0]?.kind}`);
}

const continuation = buildMockAiUiFlow({
  moduleId: "video",
  lastUserText:
    "我补充的信息如下，请继续完成刚才的任务：场景：售前；受众：客户高层；时长：60s；画幅：16:9；风格：专业商务",
});
const kinds = continuation?.parts.map((part) => part.kind) ?? [];
if (!kinds.includes("video_requirement_summary") || !kinds.includes("video_outline")) {
  throw new Error(`video continuation missing expected parts: ${kinds.join(",")}`);
}
if (continuation?.deliverables?.kind !== "deliverables") {
  throw new Error("video continuation should include deliverables");
}
const deliverables = continuation.deliverables;
if (
  deliverables.kind !== "deliverables" ||
  deliverables.primaryPath !== "presentation" ||
  !deliverables.items.some((item) => item.path === "presentation" && item.previewUrl?.includes("?reel=1")) ||
  !deliverables.items.some((item) => item.path === "script.md") ||
  !deliverables.items.some((item) => item.path === "outline.md")
) {
  throw new Error("video deliverables missing presentation/script/outline");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      parts: ["video_requirements", "video_requirement_summary", "video_outline"],
      deliverables: deliverables.items.map((item) => item.path),
    },
    null,
    2,
  ),
);
