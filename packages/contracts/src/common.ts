import { z } from "zod";

export const workspaceKindSchema = z.enum(["sandbox", "local_bound", "cloud"]);
export type WorkspaceKind = z.infer<typeof workspaceKindSchema>;

export const apiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
