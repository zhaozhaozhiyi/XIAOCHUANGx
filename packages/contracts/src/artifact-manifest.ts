import { z } from "zod";
import { moduleStageSchema, productModuleIdSchema } from "./module-adapter";

export const artifactManifestStatusSchema = z.enum([
  "generating",
  "ready",
  "partial",
  "failed",
]);
export type ArtifactManifestStatus = z.infer<
  typeof artifactManifestStatusSchema
>;

export const artifactRoleSchema = z.enum([
  "primary",
  "preview",
  "generated_format",
  "source",
  "intermediate",
  "attachment",
]);
export type ArtifactRole = z.infer<typeof artifactRoleSchema>;

export const artifactPreviewTypeSchema = z.enum([
  "html",
  "image",
  "model",
  "video",
  "document",
  "directory",
]);
export type ArtifactPreviewType = z.infer<typeof artifactPreviewTypeSchema>;

export const artifactAvailabilityStatusSchema = z.enum([
  "available",
  "pending",
  "failed",
]);
export type ArtifactAvailabilityStatus = z.infer<
  typeof artifactAvailabilityStatusSchema
>;

export const artifactItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  path: z.string(),
  role: artifactRoleSchema,
  mimeType: z.string().optional(),
  size: z.number().optional(),
});
export type ArtifactItem = z.infer<typeof artifactItemSchema>;

export const artifactPreviewSchema = z.object({
  id: z.string(),
  type: artifactPreviewTypeSchema,
  label: z.string(),
  url: z.string().optional(),
  path: z.string().optional(),
  status: artifactAvailabilityStatusSchema,
});
export type ArtifactPreview = z.infer<typeof artifactPreviewSchema>;

export const artifactGeneratedFormatSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  path: z.string().optional(),
  status: artifactAvailabilityStatusSchema,
});
export type ArtifactGeneratedFormat = z.infer<
  typeof artifactGeneratedFormatSchema
>;

export const artifactConversionStatusSchema = z.enum([
  "can_generate",
  "generating",
  "failed",
  "planned",
]);
export type ArtifactConversionStatus = z.infer<
  typeof artifactConversionStatusSchema
>;

export const artifactConversionSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  sourceArtifactId: z.string().optional(),
  status: artifactConversionStatusSchema,
});
export type ArtifactConversion = z.infer<typeof artifactConversionSchema>;

export const artifactActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum([
    "open",
    "preview",
    "generate_format",
    "revise",
    "continue",
  ]),
  targetArtifactId: z.string().optional(),
  enabled: z.boolean(),
});
export type ArtifactAction = z.infer<typeof artifactActionSchema>;

export const artifactManifestSchema = z.object({
  version: z.literal(1),
  moduleId: productModuleIdSchema,
  runId: z.string(),
  sessionId: z.string(),
  projectId: z.string().optional(),
  title: z.string(),
  status: artifactManifestStatusSchema,
  stage: moduleStageSchema.optional(),
  primaryArtifact: artifactItemSchema.optional(),
  artifacts: z.array(artifactItemSchema),
  previews: z.array(artifactPreviewSchema).optional(),
  generatedFormats: z.array(artifactGeneratedFormatSchema).optional(),
  availableConversions: z.array(artifactConversionSchema).optional(),
  actions: z.array(artifactActionSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ArtifactManifest = z.infer<typeof artifactManifestSchema>;
