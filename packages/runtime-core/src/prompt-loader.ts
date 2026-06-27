import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolvePromptsRoot } from "./paths.js";

const PLATFORM_FILES = [
  "identity.md",
  "mode-hints.md",
  "chat-orchestration.md",
  "workflow.md",
] as const;

function readMarkdownFile(path: string): string {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8").trim();
}

/** 加载 `prompts/platform/` 下平台 Prompt（交付可改） */
export function loadPlatformPrompts(
  promptsRoot = resolvePromptsRoot(),
): { body: string; files: string[]; missing: string[] } {
  const platformDir = join(promptsRoot, "platform");
  const parts: string[] = [];
  const files: string[] = [];
  const missing: string[] = [];

  for (const name of PLATFORM_FILES) {
    const path = join(platformDir, name);
    if (!existsSync(path)) {
      missing.push(name);
      continue;
    }
    const content = readMarkdownFile(path);
    if (content) {
      files.push(name);
      parts.push(`<!-- platform:${name} -->`, content);
    }
  }

  // 额外 .md（交付扩展），按文件名排序，排除已列出的
  if (existsSync(platformDir)) {
    const known = new Set<string>(PLATFORM_FILES);
    for (const name of readdirSync(platformDir).sort()) {
      if (!name.endsWith(".md") || known.has(name)) continue;
      const path = join(platformDir, name);
      const content = readMarkdownFile(path);
      if (content) {
        files.push(name);
        parts.push(`<!-- platform:${name} -->`, content);
      }
    }
  }

  return { body: parts.join("\n\n"), files, missing };
}
