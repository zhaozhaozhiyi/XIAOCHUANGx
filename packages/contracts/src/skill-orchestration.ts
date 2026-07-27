import { z } from "zod";

export const SKILL_MANIFEST_VERSION = 1 as const;
export const SKILL_DECISION_VERSION = 1 as const;
export const SKILL_EVENT_VERSION = 1 as const;

export const skillSlugSchema = z
  .string()
  .regex(/^skill-[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const skillKindSchema = z.enum(["workflow", "tool"]);
export type SkillKind = z.infer<typeof skillKindSchema>;

export const skillScopeSchema = z.enum([
  "chat",
  "writing",
  "ppt",
  "video",
  "3d",
  "simulation",
  "knowledge",
  "translate",
  "meeting",
]);
export type SkillScope = z.infer<typeof skillScopeSchema>;

export const skillBindingModuleSchema = z.enum([
  "writing",
  "ppt",
  "video",
  "3d",
  "simulation",
]);

export const skillStatusSchema = z.enum(["active", "disabled"]);
export type SkillStatus = z.infer<typeof skillStatusSchema>;

export const skillSelectionSourceSchema = z.enum([
  "explicit",
  "template",
  "module",
  "continuation",
  "intent",
  "none",
]);
export type SkillSelectionSource = z.infer<
  typeof skillSelectionSourceSchema
>;

export const skillSelectionReasonCodeSchema = z.enum([
  "explicit_structured",
  "explicit_text_action",
  "template_binding",
  "module_binding",
  "workflow_continuation",
  "intent_unique_match",
  "no_match",
  "intent_ambiguous",
  "intent_excluded",
  "continuation_rejected",
  "cross_module_conflict",
  "explicit_invalid_format",
  "explicit_not_found",
  "explicit_disabled",
  "explicit_source_not_allowed",
  "capability_unavailable",
]);
export type SkillSelectionReasonCode = z.infer<
  typeof skillSelectionReasonCodeSchema
>;

export const skillFailureStageSchema = z.enum([
  "selection",
  "manifest",
  "body",
  "dependency",
  "asset",
]);
export type SkillFailureStage = z.infer<typeof skillFailureStageSchema>;

export const skillFailureCodeSchema = z.enum([
  "invalid_slug",
  "skill_not_found",
  "skill_disabled",
  "source_not_allowed",
  "capability_unavailable",
  "manifest_invalid",
  "body_missing",
  "body_read_failed",
  "dependency_missing",
  "dependency_cycle",
  "dependency_failed",
  "asset_missing",
  "asset_prepare_failed",
  "internal_error",
]);
export type SkillFailureCode = z.infer<typeof skillFailureCodeSchema>;

export const skillFallbackModeSchema = z.enum([
  "none",
  "basic",
  "blocked",
  "clarification",
  "retry",
]);
export type SkillFallbackMode = z.infer<typeof skillFallbackModeSchema>;

export const skillCacheStatusSchema = z.enum(["miss", "memory-hit"]);
export type SkillCacheStatus = z.infer<typeof skillCacheStatusSchema>;

export const skillBundleCacheStatusSchema = z.enum([
  "miss",
  "partial-hit",
  "full-hit",
]);
export type SkillBundleCacheStatus = z.infer<
  typeof skillBundleCacheStatusSchema
>;

export const skillTriggerSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["phrase", "regex"]),
  pattern: z.string().min(1),
  flags: z.string().regex(/^[imu]*$/).optional(),
});
export type SkillTrigger = z.infer<typeof skillTriggerSchema>;

export const skillManifestV1Schema = z.object({
  manifestVersion: z.literal(SKILL_MANIFEST_VERSION),
  slug: skillSlugSchema,
  version: z.string().min(1),
  kind: skillKindSchema,
  scope: z.array(skillScopeSchema).min(1),
  summary: z.string().min(1).max(240),
  status: skillStatusSchema,
  selectableSources: z.array(skillSelectionSourceSchema.exclude(["none"])),
  bindings: z.object({
    moduleIds: z.array(skillBindingModuleSchema),
    templates: z.array(
      z.object({
        moduleId: skillBindingModuleSchema,
        templateId: z.string().min(1),
      }),
    ),
  }),
  triggers: z.array(skillTriggerSchema),
  excludes: z.array(skillTriggerSchema),
  priority: z.number().int(),
  skillDependencies: z.array(skillSlugSchema),
  capabilityRequirements: z.array(z.string().min(1)),
  assetPolicy: z.object({
    references: z.boolean(),
    scripts: z.boolean(),
    templates: z.boolean(),
    assets: z.boolean(),
  }),
});
export type SkillManifestV1 = z.infer<typeof skillManifestV1Schema>;

export const skillRegistryV1Schema = z.object({
  registryVersion: z.string().min(1),
  selectorVersion: z.string().min(1),
  generatedAt: z.string().datetime(),
  skills: z.array(skillManifestV1Schema),
});
export type SkillRegistryV1 = z.infer<typeof skillRegistryV1Schema>;

export const skillSelectionDecisionV1Schema = z
  .object({
    decisionVersion: z.literal(SKILL_DECISION_VERSION),
    decisionId: z.string().min(1),
    sessionId: z.string().min(1),
    runId: z.string().min(1),
    decisionOutcome: z.enum(["selected", "none", "rejected"]),
    requestedSkillSlug: z.string().min(1).nullable(),
    primarySkillSlug: skillSlugSchema.nullable(),
    requiredSkillSlugs: z.array(skillSlugSchema),
    selectionSource: skillSelectionSourceSchema,
    reasonCode: skillSelectionReasonCodeSchema,
    reasonText: z.string().min(1).max(500),
    selectorVersion: z.string().min(1),
    decidedAt: z.string().datetime(),
  })
  .superRefine((decision, ctx) => {
    if (decision.decisionOutcome === "selected") {
      if (!decision.primarySkillSlug) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["primarySkillSlug"],
          message: "selected decision requires primarySkillSlug",
        });
      }
      if (decision.selectionSource === "none") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["selectionSource"],
          message: "selected decision requires a concrete selection source",
        });
      }
    } else {
      if (decision.primarySkillSlug !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["primarySkillSlug"],
          message: "non-selected decision cannot contain primarySkillSlug",
        });
      }
      if (decision.requiredSkillSlugs.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["requiredSkillSlugs"],
          message: "non-selected decision cannot contain required skills",
        });
      }
    }
    if (
      decision.decisionOutcome === "none" &&
      decision.selectionSource !== "none"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selectionSource"],
        message: "none decision requires selectionSource=none",
      });
    }
    if (
      decision.decisionOutcome === "rejected" &&
      decision.selectionSource !== "explicit"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selectionSource"],
        message: "rejected decision requires selectionSource=explicit",
      });
    }
  });
export type SkillSelectionDecisionV1 = z.infer<
  typeof skillSelectionDecisionV1Schema
>;

const skillEventBaseSchema = z.object({
  skillEventVersion: z.literal(SKILL_EVENT_VERSION),
  eventId: z.string().min(1),
  decisionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().min(1),
  occurredAt: z.string().datetime(),
  /** Assigned at the Companion stream boundary; optional for old records. */
  streamSeq: z.number().int().nonnegative().optional(),
});

export const skillSelectedEventSchema = skillEventBaseSchema.extend({
  type: z.literal("skill.selected"),
  primarySkillSlug: skillSlugSchema,
  requiredSkillSlugs: z.array(skillSlugSchema),
  selectionSource: skillSelectionSourceSchema.exclude(["none"]),
  reasonCode: skillSelectionReasonCodeSchema,
});
export type SkillSelectedEvent = z.infer<typeof skillSelectedEventSchema>;

export const skillBundleItemSchema = z.object({
  slug: skillSlugSchema,
  version: z.string().min(1),
  contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  cacheStatus: skillCacheStatusSchema,
});
export type SkillBundleItem = z.infer<typeof skillBundleItemSchema>;

export const skillReadyEventSchema = skillEventBaseSchema.extend({
  type: z.literal("skill.ready"),
  items: z.array(skillBundleItemSchema).min(1),
  bundleHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  bundleCacheStatus: skillBundleCacheStatusSchema,
  agentKitPath: z.string().nullable(),
});
export type SkillReadyEvent = z.infer<typeof skillReadyEventSchema>;

export const skillFailedEventSchema = skillEventBaseSchema.extend({
  type: z.literal("skill.failed"),
  failedSkillSlug: z.string().min(1),
  failureStage: skillFailureStageSchema,
  loadedItems: z.array(skillBundleItemSchema),
  failureCode: skillFailureCodeSchema,
  failureMessage: z.string().min(1),
  fallbackMode: skillFallbackModeSchema,
});
export type SkillFailedEvent = z.infer<typeof skillFailedEventSchema>;
