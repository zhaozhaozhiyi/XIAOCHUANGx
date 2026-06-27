import { z } from "zod";
import { localBoundSourceSchema, workspaceKindSchema } from "./common";

export const createProjectRequestSchema = z
  .object({
    workspaceKind: workspaceKindSchema,
    baseDir: z.string().min(1).optional(),
    name: z.string().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.workspaceKind === "local_bound" && !data.baseDir) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "local_bound 项目必须提供 baseDir",
        path: ["baseDir"],
      });
    }
    if (data.workspaceKind !== "local_bound" && data.baseDir) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "仅 local_bound 可设置 baseDir",
        path: ["baseDir"],
      });
    }
  });

export const ensureDefaultTaskProjectRequestSchema = z.object({
  moduleId: z.enum(["chat", "meeting", "knowledge", "writing", "ppt"]),
  taskTitle: z.string().max(200).optional(),
  taskId: z.string().max(200).optional(),
});

export type EnsureDefaultTaskProjectRequest = z.infer<
  typeof ensureDefaultTaskProjectRequestSchema
>;

/** Companion ensure-default 响应（字段名 projectId，与 CompanionProjectSummary 对齐） */
export const ensureDefaultTaskProjectResponseSchema = z.object({
  projectId: z.string(),
  name: z.string(),
  workspaceKind: z.literal("local_bound"),
  bindingSource: z.literal("platform_default"),
  pathSummary: z.string(),
  baseDir: z.string(),
});

export type EnsureDefaultTaskProjectResponse = z.infer<
  typeof ensureDefaultTaskProjectResponseSchema
>;

export const projectSchema = z.object({
  id: z.string(),
  workspaceKind: workspaceKindSchema,
  baseDir: z.string().nullable(),
  name: z.string().nullable(),
  /** 仅 local_bound；platform_default = XIAOCHUANG 预授权目录 */
  bindingSource: localBoundSourceSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ProjectDto = z.infer<typeof projectSchema>;

export const createProjectResponseSchema = z.object({
  project: projectSchema,
});

export const listProjectsResponseSchema = z.object({
  projects: z.array(projectSchema),
});
