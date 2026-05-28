import { z } from "zod";

export const workspaceKindSchema = z.enum(["sandbox", "local_bound", "cloud"]);
export type WorkspaceKind = z.infer<typeof workspaceKindSchema>;

/** local_bound 绑定来源（PRD §5.3.2.2.1） */
export const localBoundSourceSchema = z.enum([
  "user_picked",
  "platform_default",
]);
export type LocalBoundSource = z.infer<typeof localBoundSourceSchema>;

export const apiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
