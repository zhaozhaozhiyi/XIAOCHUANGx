import { z } from "zod";
import { workspaceKindSchema } from "./common";

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

export const projectSchema = z.object({
  id: z.string(),
  workspaceKind: workspaceKindSchema,
  baseDir: z.string().nullable(),
  name: z.string().nullable(),
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
