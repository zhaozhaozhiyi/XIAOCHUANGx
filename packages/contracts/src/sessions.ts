import { z } from "zod";

export const createChatSessionRequestSchema = z
  .object({
    projectId: z.string().optional(),
    createProject: z
      .object({
        workspaceKind: z.enum(["sandbox", "local_bound", "cloud"]),
        baseDir: z.string().optional(),
        name: z.string().optional(),
      })
      .optional(),
    title: z.string().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.projectId && !data.createProject) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "须指定 projectId 或 createProject",
      });
    }
    if (data.projectId && data.createProject) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "projectId 与 createProject 不可同时传入",
      });
    }
  });

export const chatSessionSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export type ChatSessionDto = z.infer<typeof chatSessionSchema>;

export const createChatSessionResponseSchema = z.object({
  session: chatSessionSchema,
  project: z.object({
    id: z.string(),
    workspaceKind: z.enum(["sandbox", "local_bound", "cloud"]),
  }),
});

export const listChatSessionsResponseSchema = z.object({
  sessions: z.array(chatSessionSchema),
});
