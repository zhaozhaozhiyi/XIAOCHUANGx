/** 估算 prompt 字节数，供 argv / context 上限判断使用。 */
export function estimatePromptBytes(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

/** 估算 argv 占用（Windows ~32KB）；供仍使用 argv 的 CLI 适配器做预算检查。 */
export const DEFAULT_ARGV_PROMPT_BUDGET_BYTES = 28_000;
