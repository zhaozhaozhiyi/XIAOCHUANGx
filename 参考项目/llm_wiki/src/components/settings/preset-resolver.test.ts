import { describe, expect, it } from "vitest"
import { LLM_PRESETS } from "./llm-presets"
import { resolveConfig } from "./preset-resolver"
import type { LlmConfig } from "@/stores/wiki-store"
import type { LlmPreset } from "./llm-presets"

function fallbackConfig(overrides: Partial<LlmConfig> = {}): LlmConfig {
  return {
    provider: "openai",
    apiKey: "sk-old",
    model: "gpt-4o",
    ollamaUrl: "http://localhost:11434",
    customEndpoint: "https://example.test/v1",
    maxContextSize: 8192,
    reasoning: { mode: "high" },
    ...overrides,
  }
}

describe("resolveConfig", () => {
  it("keeps DeepSeek presets aligned with the current V4 model list", () => {
    const deepseek = LLM_PRESETS.find((preset) => preset.id === "deepseek")

    expect(deepseek?.defaultModel).toBe("deepseek-v4-flash")
    expect(deepseek?.suggestedModels).toEqual([
      "deepseek-v4-flash",
      "deepseek-v4-pro",
      "deepseek-chat",
      "deepseek-reasoner",
    ])
  })

  it("defaults reasoning to auto instead of inheriting another preset's fallback", () => {
    const preset: LlmPreset = {
      id: "deepseek",
      label: "DeepSeek",
      provider: "custom",
      baseUrl: "https://api.deepseek.com/v1",
      defaultModel: "deepseek-chat",
      apiMode: "chat_completions",
    }

    const resolved = resolveConfig(preset, undefined, fallbackConfig())

    expect(resolved.reasoning).toEqual({ mode: "auto" })
  })

  it("keeps an explicit provider-level reasoning override", () => {
    const preset: LlmPreset = {
      id: "qwen",
      label: "Qwen",
      provider: "custom",
      baseUrl: "http://localhost:8000/v1",
      defaultModel: "Qwen3.5-122B",
      apiMode: "chat_completions",
    }

    const resolved = resolveConfig(
      preset,
      { reasoning: { mode: "off" } },
      fallbackConfig(),
    )

    expect(resolved.reasoning).toEqual({ mode: "off" })
  })

  it("carries Azure API version and model family overrides", () => {
    const preset: LlmPreset = {
      id: "azure",
      label: "Azure OpenAI",
      provider: "azure",
      baseUrl: "https://resource.openai.azure.com",
      defaultModel: "wiki-main",
      azureApiVersion: "2024-10-21",
    }

    const resolved = resolveConfig(
      preset,
      { azureApiVersion: "2025-01-01-preview", azureModelFamily: "gpt5" },
      fallbackConfig(),
    )

    expect(resolved.azureApiVersion).toBe("2025-01-01-preview")
    expect(resolved.azureModelFamily).toBe("gpt5")
  })
})
