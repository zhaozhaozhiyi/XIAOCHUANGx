import { z } from "zod";

export const productModuleIdSchema = z.enum([
  "chat",
  "writing",
  "ppt",
  "3d",
  "video",
  "simulation",
]);
export type ProductModuleId = z.infer<typeof productModuleIdSchema>;

export const moduleStageSchema = z.enum([
  "intake",
  "planning",
  "generation",
  "preview",
  "revision",
  "delivery",
  "done",
]);
export type ModuleStage = z.infer<typeof moduleStageSchema>;

export const moduleWorkbenchTypeSchema = z.enum([
  "chat",
  "document",
  "ppt",
  "video",
  "industrial_drawing",
  "simulation",
]);
export type ModuleWorkbenchType = z.infer<typeof moduleWorkbenchTypeSchema>;

export const moduleWorkbenchLayoutSchema = z.enum([
  "chat-first",
  "split",
  "workbench-first",
]);
export type ModuleWorkbenchLayout = z.infer<
  typeof moduleWorkbenchLayoutSchema
>;

export const moduleActionKindSchema = z.enum([
  "open",
  "preview",
  "generate_format",
  "revise",
  "regenerate",
  "continue",
  "custom",
]);
export type ModuleActionKind = z.infer<typeof moduleActionKindSchema>;

export const moduleActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: moduleActionKindSchema,
  description: z.string().optional(),
  requiresArtifact: z.boolean().optional(),
});
export type ModuleAction = z.infer<typeof moduleActionSchema>;

export const moduleAdapterSchema = z.object({
  version: z.literal(1),
  id: productModuleIdSchema,
  label: z.string(),
  description: z.string(),
  lifecycle: z.object({
    stages: z.array(moduleStageSchema).min(1),
    defaultStage: moduleStageSchema,
  }),
  skills: z.object({
    defaultSkill: z.string().nullable(),
    availableSkills: z.array(z.string()).optional(),
    supportSkills: z.array(z.string()).optional(),
    allowSkillPicker: z.boolean().optional(),
  }),
  requirements: z.object({
    partKinds: z.array(z.string()),
    summaryPartKinds: z.array(z.string()).optional(),
    outlinePartKinds: z.array(z.string()).optional(),
    requiresConfirmation: z.boolean().optional(),
  }),
  artifacts: z.object({
    primaryTypes: z.array(z.string()),
    previewTypes: z.array(z.string()),
    generatedFormatTypes: z.array(z.string()),
    intermediateTypes: z.array(z.string()).optional(),
  }),
  workbench: z.object({
    enabled: z.boolean(),
    type: moduleWorkbenchTypeSchema.optional(),
    preferredLayout: moduleWorkbenchLayoutSchema.optional(),
  }),
  actions: z.object({
    primary: z.array(moduleActionSchema),
    continue: z.array(moduleActionSchema),
    generate: z.array(moduleActionSchema),
  }),
  acceptance: z.object({
    smoke: z.array(z.string()),
    failureStates: z.array(z.string()),
  }),
});
export type ModuleAdapter = z.infer<typeof moduleAdapterSchema>;
