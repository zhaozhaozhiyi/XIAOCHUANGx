/** Companion `run.started` 载荷与 Activity 展示文案（F-RT-008 / S1O.3c） */

export type RunStartedPayload = {
  runId: string;
  baseProcessSkill?: string | null;
  processSkill?: string | null;
  platformNormSkill?: string | null;
  orchestrationMode?: string | null;
  catalogVersion?: string | null;
  catalogSlugs?: string[] | null;
  injectedSkills?: string[] | null;
};

export function parseRunStartedPayload(
  json: Record<string, unknown>,
): RunStartedPayload {
  const runId =
    typeof json.runId === "string" ? json.runId : `run-${Date.now()}`;
  return {
    runId,
    baseProcessSkill:
      typeof json.baseProcessSkill === "string"
        ? json.baseProcessSkill
        : typeof json.processSkill === "string"
          ? json.processSkill
          : null,
    processSkill:
      typeof json.processSkill === "string" ? json.processSkill : null,
    platformNormSkill:
      typeof json.platformNormSkill === "string" ? json.platformNormSkill : null,
    orchestrationMode:
      typeof json.orchestrationMode === "string"
        ? json.orchestrationMode
        : null,
    catalogVersion:
      typeof json.catalogVersion === "string" ? json.catalogVersion : null,
    catalogSlugs: Array.isArray(json.catalogSlugs)
      ? json.catalogSlugs.filter((s): s is string => typeof s === "string")
      : null,
    injectedSkills: Array.isArray(json.injectedSkills)
      ? json.injectedSkills.filter((s): s is string => typeof s === "string")
      : null,
  };
}

const PROCESS_SKILL_LABELS: Record<string, string> = {
  "skill-qa": "自动问答",
  "skill-qa-fast": "快速问答",
  "skill-qa-deep": "深度问答",
};

export function labelForProcessSkill(slug: string | null | undefined): string {
  if (!slug) return "默认";
  return PROCESS_SKILL_LABELS[slug] ?? slug.replace(/^skill-/, "");
}

/** Activity 首条状态 chip 文案 */
export function orchestrationStatusLabel(payload: RunStartedPayload): string {
  const slug = payload.baseProcessSkill ?? payload.processSkill;
  const base = labelForProcessSkill(slug);
  const parts = [`基座 · ${base}`];
  if (payload.orchestrationMode === "hybrid-steer") {
    const n = payload.catalogSlugs?.length ?? 0;
    if (n > 0) {
      parts.push(`${n} 个扩展 Skill 可参考`);
    }
  }
  return parts.join(" · ");
}
