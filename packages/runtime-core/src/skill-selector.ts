import type {
  SkillManifestV1,
  SkillSelectionDecisionV1,
  SkillSelectionReasonCode,
  SkillSelectionSource,
} from "@jlc/contracts";
import type { SkillRegistrySnapshot } from "./skill-registry.js";

const SKILL_SLUG_RE = /^skill-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TEXT_SKILL_SLUG_RE = /skill-[a-z0-9]+(?:-[a-z0-9]+)*/g;
const CONTINUATION_RE =
  /(?:^|[，。！？,.!?\s])(?:继续|接着|沿用|基于刚才|补充|修改上文|完善上文|continue|keep going|build on (?:that|the previous))/i;
const NEW_SIMPLE_TOPIC_RE =
  /(?:\d+\s*[+\-*/×÷]\s*\d+|等于几|天气|几点|日期|翻译这个词|what time|weather)/i;
const NEGATED_SKILL_ACTION_RE =
  /(?:不要|别|无需|不必|禁止|do not|don't|without)\s*(?:使用|调用|运行|use|invoke|run)?\s*skill-[a-z0-9-]+/i;

export type SkillSelectorModuleId =
  | "chat"
  | "writing"
  | "ppt"
  | "3d"
  | "video"
  | "simulation";

export type SkillContinuationState = {
  primarySkillSlug: string;
  succeeded: boolean;
};

export type SelectSkillInput = {
  registry: SkillRegistrySnapshot;
  decisionId: string;
  runId: string;
  sessionId: string;
  decidedAt: string;
  moduleId: SkillSelectorModuleId;
  templateId?: string | null;
  requestedSkillSlug?: string | null;
  userText: string;
  continuation?: SkillContinuationState | null;
  availableCapabilities?: ReadonlySet<string>;
};

function baseDecision(
  input: SelectSkillInput,
  fields: Omit<
    SkillSelectionDecisionV1,
    | "decisionVersion"
    | "decisionId"
    | "runId"
    | "sessionId"
    | "selectorVersion"
    | "decidedAt"
  >,
): SkillSelectionDecisionV1 {
  return {
    decisionVersion: 1,
    decisionId: input.decisionId,
    runId: input.runId,
    sessionId: input.sessionId,
    selectorVersion: input.registry.registry.selectorVersion,
    decidedAt: input.decidedAt,
    ...fields,
  };
}

function dependencyClosure(
  primary: SkillManifestV1,
  registry: SkillRegistrySnapshot,
): string[] {
  const result = new Set<string>();
  const visit = (manifest: SkillManifestV1): void => {
    for (const slug of manifest.skillDependencies) {
      if (result.has(slug)) continue;
      result.add(slug);
      const dependency = registry.bySlug.get(slug);
      if (dependency) visit(dependency);
    }
  };
  visit(primary);
  return [...result].sort();
}

function missingBundleCapabilities(
  primary: SkillManifestV1,
  registry: SkillRegistrySnapshot,
  available?: ReadonlySet<string>,
): string[] {
  if (!available) return [];
  const requirements = new Set(primary.capabilityRequirements);
  for (const slug of dependencyClosure(primary, registry)) {
    const dependency = registry.bySlug.get(slug);
    for (const requirement of dependency?.capabilityRequirements ?? []) {
      requirements.add(requirement);
    }
  }
  return [...requirements].filter((requirement) => !available.has(requirement));
}

function selectedDecision(
  input: SelectSkillInput,
  manifest: SkillManifestV1,
  source: Exclude<SkillSelectionSource, "none">,
  reasonCode: SkillSelectionReasonCode,
  reasonText: string,
  requestedSkillSlug: string | null = null,
): SkillSelectionDecisionV1 {
  return baseDecision(input, {
    decisionOutcome: "selected",
    requestedSkillSlug,
    primarySkillSlug: manifest.slug,
    requiredSkillSlugs: dependencyClosure(manifest, input.registry),
    selectionSource: source,
    reasonCode,
    reasonText,
  });
}

function noneDecision(
  input: SelectSkillInput,
  reasonCode: Extract<
    SkillSelectionReasonCode,
    | "no_match"
    | "intent_ambiguous"
    | "intent_excluded"
    | "continuation_rejected"
    | "cross_module_conflict"
    | "capability_unavailable"
  >,
  reasonText: string,
): SkillSelectionDecisionV1 {
  return baseDecision(input, {
    decisionOutcome: "none",
    requestedSkillSlug: null,
    primarySkillSlug: null,
    requiredSkillSlugs: [],
    selectionSource: "none",
    reasonCode,
    reasonText,
  });
}

function rejectedDecision(
  input: SelectSkillInput,
  requestedSkillSlug: string,
  reasonCode: Extract<
    SkillSelectionReasonCode,
    | "explicit_invalid_format"
    | "explicit_not_found"
    | "explicit_disabled"
    | "explicit_source_not_allowed"
    | "capability_unavailable"
  >,
  reasonText: string,
): SkillSelectionDecisionV1 {
  return baseDecision(input, {
    decisionOutcome: "rejected",
    requestedSkillSlug,
    primarySkillSlug: null,
    requiredSkillSlugs: [],
    selectionSource: "explicit",
    reasonCode,
    reasonText,
  });
}

function selectExplicit(
  input: SelectSkillInput,
  slug: string,
  reasonCode: "explicit_structured" | "explicit_text_action",
): SkillSelectionDecisionV1 {
  if (!SKILL_SLUG_RE.test(slug)) {
    return rejectedDecision(
      input,
      slug,
      "explicit_invalid_format",
      "The requested Skill slug has an invalid format.",
    );
  }
  const manifest = input.registry.bySlug.get(slug);
  if (!manifest) {
    return rejectedDecision(
      input,
      slug,
      "explicit_not_found",
      "The requested Skill does not exist in the active Registry.",
    );
  }
  if (manifest.status !== "active") {
    return rejectedDecision(
      input,
      slug,
      "explicit_disabled",
      "The requested Skill is disabled.",
    );
  }
  if (!manifest.selectableSources.includes("explicit")) {
    return rejectedDecision(
      input,
      slug,
      "explicit_source_not_allowed",
      "The requested Skill cannot be selected explicitly.",
    );
  }
  const missing = missingBundleCapabilities(
    manifest,
    input.registry,
    input.availableCapabilities,
  );
  if (missing.length > 0) {
    return rejectedDecision(
      input,
      slug,
      "capability_unavailable",
      `Required capabilities are unavailable: ${missing.join(", ")}.`,
    );
  }
  return selectedDecision(
    input,
    manifest,
    "explicit",
    reasonCode,
    reasonCode === "explicit_structured"
      ? "The user selected this Skill through a structured request fact."
      : "The user explicitly requested this Skill with an action and full slug.",
    slug,
  );
}

function textWithoutReferences(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\n]+`/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .split(/\r?\n/)
    .filter(
      (line) =>
        !/^\s*(?:\[?(?:error|warn|info|debug)\]?[:\s]|at\s+\S+|\d{4}-\d{2}-\d{2}T)/i.test(
          line,
        ),
    )
    .join("\n");
}

function explicitSlugFromText(text: string): string | null {
  const clean = textWithoutReferences(text);
  if (NEGATED_SKILL_ACTION_RE.test(clean)) return null;
  const patterns = [
    /(?:请)?(?:使用|调用|运行|启用|采用|用)\s*(skill-[a-z0-9]+(?:-[a-z0-9]+)*)/i,
    /\b(?:use|invoke|run|apply)\s+(skill-[a-z0-9]+(?:-[a-z0-9]+)*)/i,
  ];
  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (match) return match[1].toLowerCase();
  }
  return null;
}

function matchesRule(text: string, rule: SkillManifestV1["triggers"][number]): boolean {
  if (rule.type === "phrase") {
    return text.toLocaleLowerCase().includes(rule.pattern.toLocaleLowerCase());
  }
  try {
    return new RegExp(rule.pattern, rule.flags).test(text);
  } catch {
    return false;
  }
}

function manifestForBinding(
  input: SelectSkillInput,
  source: "template" | "module",
): SkillManifestV1 | null {
  const slug =
    source === "template"
      ? input.registry.templateBindings.get(
          `${input.moduleId}:${input.templateId ?? ""}`,
        )
      : input.registry.moduleBindings.get(input.moduleId);
  if (!slug) return null;
  const manifest = input.registry.bySlug.get(slug);
  if (
    !manifest ||
    manifest.status !== "active" ||
    !manifest.selectableSources.includes(source)
  ) {
    return null;
  }
  return manifest;
}

export function selectSkill(input: SelectSkillInput): SkillSelectionDecisionV1 {
  const structuredSlug = input.requestedSkillSlug?.trim();
  if (structuredSlug) {
    return selectExplicit(input, structuredSlug, "explicit_structured");
  }

  const textSlug = explicitSlugFromText(input.userText);
  if (textSlug) {
    return selectExplicit(input, textSlug, "explicit_text_action");
  }

  if (input.moduleId !== "chat") {
    const template = input.templateId
      ? manifestForBinding(input, "template")
      : null;
    if (template) {
      const missing = missingBundleCapabilities(
        template,
        input.registry,
        input.availableCapabilities,
      );
      if (missing.length > 0) {
        return noneDecision(
          input,
          "capability_unavailable",
          `Template Skill capabilities are unavailable: ${missing.join(", ")}.`,
        );
      }
      return selectedDecision(
        input,
        template,
        "template",
        "template_binding",
        "The current module template has a deterministic Skill binding.",
      );
    }
    const module = manifestForBinding(input, "module");
    if (module) {
      const missing = missingBundleCapabilities(
        module,
        input.registry,
        input.availableCapabilities,
      );
      if (missing.length > 0) {
        return noneDecision(
          input,
          "capability_unavailable",
          `Module Skill capabilities are unavailable: ${missing.join(", ")}.`,
        );
      }
      return selectedDecision(
        input,
        module,
        "module",
        "module_binding",
        "The current non-chat module has a deterministic Skill binding.",
      );
    }
    return noneDecision(
      input,
      "cross_module_conflict",
      "No valid Skill binding exists for the current module facts.",
    );
  }

  if (input.continuation?.succeeded && CONTINUATION_RE.test(input.userText)) {
    if (NEW_SIMPLE_TOPIC_RE.test(input.userText)) {
      return noneDecision(
        input,
        "continuation_rejected",
        "A new simple topic overrides the previous workflow continuation.",
      );
    }
    const manifest = input.registry.bySlug.get(
      input.continuation.primarySkillSlug,
    );
    if (
      manifest?.status === "active" &&
      manifest.kind === "workflow" &&
      manifest.selectableSources.includes("continuation")
    ) {
      const missing = missingBundleCapabilities(
        manifest,
        input.registry,
        input.availableCapabilities,
      );
      if (missing.length > 0) {
        return noneDecision(
          input,
          "capability_unavailable",
          `Continuation Skill capabilities are unavailable: ${missing.join(", ")}.`,
        );
      }
      return selectedDecision(
        input,
        manifest,
        "continuation",
        "workflow_continuation",
        "The user explicitly continued the last successful workflow.",
      );
    }
  }

  const cleanText = textWithoutReferences(input.userText);
  if (NEGATED_SKILL_ACTION_RE.test(cleanText)) {
    return noneDecision(
      input,
      "intent_excluded",
      "A negative expression excluded Skill selection.",
    );
  }
  const matches = input.registry.registry.skills.filter((manifest) => {
    if (
      manifest.status !== "active" ||
      !manifest.scope.includes("chat") ||
      !manifest.selectableSources.includes("intent") ||
      manifest.triggers.length === 0
    ) {
      return false;
    }
    if (manifest.excludes.some((rule) => matchesRule(cleanText, rule))) {
      return false;
    }
    return manifest.triggers.some((rule) => matchesRule(cleanText, rule));
  });

  if (matches.length === 1) {
    const [manifest] = matches;
    const missing = missingBundleCapabilities(
      manifest,
      input.registry,
      input.availableCapabilities,
    );
    if (missing.length > 0) {
      return noneDecision(
        input,
        "capability_unavailable",
        `Intent matched, but required capabilities are unavailable: ${missing.join(", ")}.`,
      );
    }
    return selectedDecision(
      input,
      manifest,
      "intent",
      "intent_unique_match",
      "Exactly one high-confidence intent rule matched.",
    );
  }
  if (matches.length > 1) {
    return noneDecision(
      input,
      "intent_ambiguous",
      "Multiple high-confidence intent rules matched; no Skill was selected.",
    );
  }

  const referencedSlugs = cleanText.match(TEXT_SKILL_SLUG_RE) ?? [];
  if (referencedSlugs.length > 0) {
    return noneDecision(
      input,
      "intent_excluded",
      "A Skill slug was referenced without an explicit use action.",
    );
  }
  if (input.continuation && CONTINUATION_RE.test(input.userText)) {
    return noneDecision(
      input,
      "continuation_rejected",
      "The previous workflow was not eligible for continuation.",
    );
  }
  return noneDecision(
    input,
    "no_match",
    "No explicit fact or unique high-confidence rule selected a Skill.",
  );
}
