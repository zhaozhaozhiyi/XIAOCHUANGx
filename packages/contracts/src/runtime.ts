import { z } from "zod";
import {
  CHAT_OUTPUT_PROTOCOL_VERSION,
  canonicalFinalAnswerSchema,
  canonicalNextActionSchema,
  canonicalOutcomeSchema,
  canonicalProviderInfoSchema,
  canonicalRationaleSchema,
  canonicalArtifactSchema,
  canonicalCitationSchema,
  canonicalWorkspaceChangeSchema,
  canonicalOutputDebugSchema,
  todoItemSchema as chatTodoItemSchema,
} from "./chat";
import type { CanonicalTurnOutput } from "./chat";
import { workspaceKindSchema } from "./common";

export const agentIdSchema = z.string().min(1);
export type AgentId = z.infer<typeof agentIdSchema>;

export const agentInputStyleSchema = z.enum(["stdin", "argv", "jsonl"]);
export type AgentInputStyle = z.infer<typeof agentInputStyleSchema>;

export const agentOutputStyleSchema = z.enum([
  "plain",
  "json",
  "jsonl",
  "sse-proxy",
]);
export type AgentOutputStyle = z.infer<typeof agentOutputStyleSchema>;

export const runStatusSchema = z.enum([
  "accepted",
  "queued",
  "starting",
  "running",
  "waiting_user",
  "completed",
  "failed",
  "cancelled",
]);
export type RunStatus = z.infer<typeof runStatusSchema>;

export const runQueuePolicySchema = z.enum([
  "enqueue",
  "interrupt",
  "steer",
  "reject_if_busy",
]);
export type RunQueuePolicy = z.infer<typeof runQueuePolicySchema>;

export const waitingForSchema = z.enum([
  "approval",
  "clarification",
  "auth",
  "file_pick",
]);
export type WaitingFor = z.infer<typeof waitingForSchema>;

export const artifactKindSchema = z.enum([
  "text_block",
  "tool_batch",
  "file_read",
  "file_edit",
  "command",
  "deliverable",
  "todo",
  "citation",
  "approval_card",
  "browser_snapshot",
]);
export type ArtifactKind = z.infer<typeof artifactKindSchema>;

export const todoItemSchema = z.object({
  id: z.string(),
  content: z.string(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
});
export type RuntimeTodoItem = z.infer<typeof todoItemSchema>;

export const artifactSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text_block"),
    id: z.string(),
    markdown: z.string(),
  }),
  z.object({
    kind: z.literal("tool_batch"),
    id: z.string(),
    summary: z.string(),
    entries: z
      .array(
        z.object({
          tool: z.string(),
          status: z.enum(["running", "done", "failed"]).optional(),
          message: z.string().optional(),
        }),
      )
      .optional(),
  }),
  z.object({
    kind: z.literal("file_read"),
    id: z.string(),
    path: z.string(),
  }),
  z.object({
    kind: z.literal("file_edit"),
    id: z.string(),
    path: z.string(),
    diff: z.string().optional(),
  }),
  z.object({
    kind: z.literal("command"),
    id: z.string(),
    command: z.string(),
    exitCode: z.number().int().nullable().optional(),
  }),
  z.object({
    kind: z.literal("deliverable"),
    id: z.string(),
    title: z.string(),
    fileId: z.string().optional(),
    path: z.string().optional(),
  }),
  z.object({
    kind: z.literal("todo"),
    id: z.string(),
    items: z.array(todoItemSchema),
  }),
  z.object({
    kind: z.literal("citation"),
    id: z.string(),
    source: z.string(),
    target: z.string().optional(),
  }),
  z.object({
    kind: z.literal("approval_card"),
    id: z.string(),
    approvalId: z.string(),
    action: z.string(),
  }),
  z.object({
    kind: z.literal("browser_snapshot"),
    id: z.string(),
    url: z.string(),
    title: z.string().optional(),
  }),
]);
export type Artifact = z.infer<typeof artifactSchema>;

export const workspaceHandleSchema = z.object({
  workspaceId: z.string(),
  tenantId: z.string(),
  projectId: z.string(),
  rootLabel: z.string(),
  executionRoot: z.string(),
  readableRoots: z.array(z.string()),
  writableRoots: z.array(z.string()),
  tempRoot: z.string().optional(),
  brokerMode: z.enum(["sandbox", "git_worktree", "container_mount"]),
  workspaceKind: workspaceKindSchema,
});
export type WorkspaceHandle = z.infer<typeof workspaceHandleSchema>;

export const agentCapabilitySchema = z.object({
  agentId: agentIdSchema,
  label: z.string(),
  available: z.boolean(),
  supportsStreaming: z.boolean(),
  supportsToolProgress: z.boolean(),
  supportsNarration: z.boolean(),
  supportsResumeThread: z.boolean(),
  supportsInterrupt: z.boolean(),
  supportsSteer: z.boolean(),
  supportsApprovalPause: z.boolean(),
  supportsWorkspaceMounts: z.boolean(),
  supportsBrowser: z.boolean(),
  supportsTerminal: z.boolean(),
  inputStyle: agentInputStyleSchema,
  outputStyle: agentOutputStyleSchema,
  models: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
      }),
    )
    .optional(),
});
export type AgentCapability = z.infer<typeof agentCapabilitySchema>;

export const createRunMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});
export type CreateRunMessage = z.infer<typeof createRunMessageSchema>;

export const createRunRequestSchema = z.object({
  tenantId: z.string(),
  projectId: z.string(),
  workspaceId: z.string(),
  sessionId: z.string(),
  turnId: z.string(),
  agentId: agentIdSchema,
  agentModel: z.string(),
  mode: z.enum(["fast", "deep"]),
  queuePolicy: runQueuePolicySchema,
  userMessage: z.object({
    text: z.string(),
    mentions: z
      .array(
        z.object({
          kind: z.enum(["file", "artifact"]),
          id: z.string(),
          path: z.string().optional(),
        }),
      )
      .optional(),
    attachments: z
      .array(
        z.object({
          fileId: z.string(),
          name: z.string(),
          mimeType: z.string(),
        }),
      )
      .optional(),
  }),
  context: z
    .object({
      visibleMessages: z.array(createRunMessageSchema).optional(),
      processSkill: z.string().optional(),
      platformNormSkill: z.string().optional(),
      workspaceHints: z
        .object({
          cwd: z.string().optional(),
          openFiles: z.array(z.string()).optional(),
          selectedPaths: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .optional(),
});
export type CreateRunRequestV2 = z.infer<typeof createRunRequestSchema>;

export const runRecordSchema = z.object({
  runId: z.string(),
  tenantId: z.string(),
  projectId: z.string(),
  workspaceId: z.string(),
  sessionId: z.string(),
  turnId: z.string(),
  agentId: agentIdSchema,
  agentModel: z.string(),
  status: runStatusSchema,
  queuePolicy: runQueuePolicySchema,
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
  parentRunId: z.string().optional(),
  resumeToken: z.string().optional(),
  canonicalOutput: z
    .object({
      protocolVersion: z.literal(CHAT_OUTPUT_PROTOCOL_VERSION),
      sessionId: z.string(),
      turnId: z.string(),
      runId: z.string(),
      provider: canonicalProviderInfoSchema,
      executionClass: z
        .enum(["direct_answer", "light_analysis", "tool_required", "artifact_oriented"])
        .optional(),
      outcome: canonicalOutcomeSchema,
      finalAnswer: canonicalFinalAnswerSchema,
      rationale: canonicalRationaleSchema.optional(),
      citations: z.array(canonicalCitationSchema).optional(),
      artifacts: z.array(canonicalArtifactSchema).optional(),
      workspaceChanges: z.array(canonicalWorkspaceChangeSchema).optional(),
      todos: z.array(chatTodoItemSchema).optional(),
      nextAction: canonicalNextActionSchema.optional(),
      debug: canonicalOutputDebugSchema.optional(),
    })
    .optional(),
});
export type RunRecord = Omit<z.infer<typeof runRecordSchema>, "canonicalOutput"> & {
  canonicalOutput?: CanonicalTurnOutput;
};

export const runControlRequestSchema = z.object({
  action: z.enum(["enqueue", "interrupt", "steer"]),
  text: z.string(),
  attachments: z
    .array(
      z.object({
        fileId: z.string(),
      }),
    )
    .optional(),
});
export type RunControlRequest = z.infer<typeof runControlRequestSchema>;

export const approvalResponseSchema = z.object({
  approvalId: z.string(),
  decision: z.enum(["approve", "deny"]),
  note: z.string().optional(),
});
export type ApprovalResponse = z.infer<typeof approvalResponseSchema>;

export const clarificationResponseSchema = z.object({
  clarificationId: z.string(),
  text: z.string(),
  selectedOption: z.string().optional(),
});
export type ClarificationResponse = z.infer<typeof clarificationResponseSchema>;

export const runEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("run.accepted"),
    runId: z.string(),
    message: z.string().optional(),
  }),
  z.object({
    type: z.literal("run.queued"),
    runId: z.string(),
    position: z.number().int().nonnegative(),
    reason: z.string().optional(),
  }),
  z.object({
    type: z.literal("run.started"),
    runId: z.string(),
    cwd: z.string(),
    agentId: agentIdSchema,
    capabilities: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("run.status"),
    runId: z.string(),
    phase: z.string(),
    label: z.string(),
  }),
  z.object({
    type: z.literal("message.delta"),
    runId: z.string(),
    turnId: z.string(),
    text: z.string(),
  }),
  z.object({
    type: z.literal("message.interim"),
    runId: z.string(),
    turnId: z.string(),
    text: z.string(),
    alreadyStreamed: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("tool.progress"),
    runId: z.string(),
    toolCallId: z.string().optional(),
    tool: z.string(),
    status: z.enum(["running", "done", "failed"]),
    message: z.string().optional(),
  }),
  z.object({
    type: z.literal("artifact.append"),
    runId: z.string(),
    artifact: artifactSchema,
  }),
  z.object({
    type: z.literal("artifact.patch"),
    runId: z.string(),
    artifactId: z.string(),
    merge: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal("todo.update"),
    runId: z.string(),
    items: z.array(todoItemSchema),
  }),
  z.object({
    type: z.literal("approval.required"),
    runId: z.string(),
    approvalId: z.string(),
    action: z.string(),
    risk: z.string().optional(),
  }),
  z.object({
    type: z.literal("clarification.required"),
    runId: z.string(),
    clarificationId: z.string(),
    question: z.string(),
    options: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("run.waiting_user"),
    runId: z.string(),
    waitingFor: waitingForSchema,
  }),
  z.object({
    type: z.literal("run.resumed"),
    runId: z.string(),
  }),
  z.object({
    type: z.literal("canonical.output"),
    runId: z.string(),
    canonicalOutput: runRecordSchema.shape.canonicalOutput.unwrap(),
  }),
  z.object({
    type: z.literal("run.finished"),
    runId: z.string(),
    summary: z.string().optional(),
  }),
  z.object({
    type: z.literal("run.error"),
    runId: z.string(),
    code: z.string(),
    message: z.string(),
  }),
  z.object({
    type: z.literal("run.cancelled"),
    runId: z.string(),
  }),
]);
export type RunEvent = z.infer<typeof runEventSchema>;
