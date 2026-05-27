import {
  DEFAULT_API_PROVIDER_CONFIG,
  type ApiProviderConfig,
  type ApiProviderProtocol,
} from "@/lib/byok/shared";

/** 模型能力类型 — 对齐 Dify 分类，MVP 先覆盖对话常用项 */
export type ModelCapabilityType =
  | "llm"
  | "multimodal"
  | "embedding"
  | "rerank";

export const MODEL_CAPABILITY_LABELS: Record<ModelCapabilityType, string> = {
  llm: "文本",
  multimodal: "多模态",
  embedding: "Embedding",
  rerank: "Rerank",
};

export const MODEL_CAPABILITY_ORDER: ModelCapabilityType[] = [
  "llm",
  "multimodal",
  "embedding",
  "rerank",
];

export type ModelProviderVendorId =
  | "openai"
  | "anthropic"
  | "openrouter"
  | "deepseek"
  | "azure-openai"
  | "ollama"
  | "moonshot"
  | "zhipu"
  | "custom-openai"
  | "custom-anthropic";

export type ModelProviderVendor = {
  id: ModelProviderVendorId;
  name: string;
  description: string;
  protocol: ApiProviderProtocol;
  defaultBaseUrl: string;
  supportedTypes: ModelCapabilityType[];
  /** 品牌色，用于卡片左侧条 */
  accent: string;
};

export const MODEL_PROVIDER_VENDORS: ModelProviderVendor[] = [
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT 系列文本与多模态模型",
    protocol: "openai",
    defaultBaseUrl: "https://api.openai.com/v1",
    supportedTypes: ["llm", "multimodal", "embedding"],
    accent: "#10a37f",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude 系列 Messages API",
    protocol: "anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
    supportedTypes: ["llm", "multimodal"],
    accent: "#cc785c",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "聚合多家模型的 OpenAI 兼容网关",
    protocol: "openai",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    supportedTypes: ["llm", "multimodal"],
    accent: "#6366f1",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "DeepSeek 文本与推理模型",
    protocol: "openai",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    supportedTypes: ["llm"],
    accent: "#4d6bfe",
  },
  {
    id: "moonshot",
    name: "Moonshot",
    description: "Kimi 开放平台",
    protocol: "openai",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    supportedTypes: ["llm", "multimodal"],
    accent: "#000000",
  },
  {
    id: "zhipu",
    name: "智谱 AI",
    description: "GLM 系列模型",
    protocol: "openai",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    supportedTypes: ["llm", "multimodal", "embedding"],
    accent: "#1a56db",
  },
  {
    id: "azure-openai",
    name: "Azure OpenAI",
    description: "企业 Azure 托管 OpenAI 服务",
    protocol: "openai",
    defaultBaseUrl: "https://{resource}.openai.azure.com/openai/deployments/{deployment}",
    supportedTypes: ["llm", "multimodal", "embedding"],
    accent: "#0078d4",
  },
  {
    id: "ollama",
    name: "Ollama",
    description: "本地 OpenAI 兼容推理服务",
    protocol: "openai",
    defaultBaseUrl: "http://localhost:11434/v1",
    supportedTypes: ["llm", "multimodal", "embedding"],
    accent: "#ffffff",
  },
  {
    id: "custom-openai",
    name: "自定义 OpenAI 兼容",
    description: "任意 OpenAI 兼容网关或企业代理",
    protocol: "openai",
    defaultBaseUrl: "https://api.openai.com/v1",
    supportedTypes: ["llm", "multimodal", "embedding", "rerank"],
    accent: "#87867f",
  },
  {
    id: "custom-anthropic",
    name: "自定义 Anthropic",
    description: "Anthropic Messages API 兼容服务",
    protocol: "anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
    supportedTypes: ["llm", "multimodal"],
    accent: "#87867f",
  },
];

export type ModelEntry = {
  id: string;
  modelId: string;
  label: string;
  type: ModelCapabilityType;
  enabled: boolean;
};

export type ModelProviderInstance = {
  id: string;
  vendorId: ModelProviderVendorId;
  enabled: boolean;
  displayName: string;
  protocol: ApiProviderProtocol;
  baseUrl: string;
  apiKey: string;
  anthropicVersion: string;
  models: ModelEntry[];
  createdAt: string;
};

export type ApiModelSelection = {
  providerId: string;
  modelEntryId: string;
};

export function vendorById(
  id: ModelProviderVendorId,
): ModelProviderVendor | undefined {
  return MODEL_PROVIDER_VENDORS.find((v) => v.id === id);
}

export function createProviderId(): string {
  return `mp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createModelEntryId(): string {
  return `md_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createProviderFromVendor(
  vendorId: ModelProviderVendorId,
): ModelProviderInstance {
  const vendor = vendorById(vendorId) ?? MODEL_PROVIDER_VENDORS[0]!;
  return {
    id: createProviderId(),
    vendorId: vendor.id,
    enabled: true,
    displayName: vendor.name,
    protocol: vendor.protocol,
    baseUrl: vendor.defaultBaseUrl,
    apiKey: "",
    anthropicVersion: "2023-06-01",
    models: [],
    createdAt: new Date().toISOString(),
  };
}

export function providerToApiConfig(
  provider: ModelProviderInstance,
  modelId?: string,
): ApiProviderConfig {
  const llm =
    provider.models.find(
      (m) => m.enabled && m.type === "llm" && (!modelId || m.id === modelId),
    ) ??
    provider.models.find((m) => m.enabled && m.type === "llm") ??
    provider.models.find((m) => m.enabled);

  return {
    enabled: provider.enabled,
    protocol: provider.protocol,
    baseUrl: provider.baseUrl.trim(),
    apiKey: provider.apiKey.trim(),
    model: llm?.modelId ?? "",
    providerLabel: provider.displayName.trim() || vendorById(provider.vendorId)?.name || "Model API",
    anthropicVersion: provider.anthropicVersion.trim() || "2023-06-01",
  };
}

export function hasUsableProviderInstance(
  provider: ModelProviderInstance,
): boolean {
  return !!(
    provider.enabled &&
    provider.baseUrl.trim() &&
    provider.models.some((m) => m.enabled && m.modelId.trim())
  );
}

export function hasAnyUsableProvider(
  providers: ModelProviderInstance[] | undefined,
): boolean {
  return (providers ?? []).some(hasUsableProviderInstance);
}

export function getLlmModels(
  providers: ModelProviderInstance[],
): Array<{
  provider: ModelProviderInstance;
  model: ModelEntry;
}> {
  const items: Array<{ provider: ModelProviderInstance; model: ModelEntry }> =
    [];
  for (const provider of providers) {
    if (!provider.enabled) continue;
    for (const model of provider.models) {
      if (!model.enabled || model.type !== "llm" || !model.modelId.trim()) {
        continue;
      }
      items.push({ provider, model });
    }
  }
  return items;
}

export function resolveApiSelection(
  providers: ModelProviderInstance[],
  selection: ApiModelSelection | null | undefined,
): ApiModelSelection | null {
  if (!selection) return null;
  const provider = providers.find((p) => p.id === selection.providerId);
  const model = provider?.models.find((m) => m.id === selection.modelEntryId);
  if (!provider || !model || !model.enabled || model.type !== "llm") {
    return null;
  }
  return selection;
}

export function defaultApiSelection(
  providers: ModelProviderInstance[],
): ApiModelSelection | null {
  const first = getLlmModels(providers)[0];
  if (!first) return null;
  return { providerId: first.provider.id, modelEntryId: first.model.id };
}

export function selectionToApiConfig(
  providers: ModelProviderInstance[],
  selection: ApiModelSelection | null | undefined,
): ApiProviderConfig {
  const resolved = resolveApiSelection(providers, selection);
  if (!resolved) return { ...DEFAULT_API_PROVIDER_CONFIG, enabled: false };

  const provider = providers.find((p) => p.id === resolved.providerId)!;
  const model = provider.models.find((m) => m.id === resolved.modelEntryId)!;
  return {
    enabled: provider.enabled,
    protocol: provider.protocol,
    baseUrl: provider.baseUrl.trim(),
    apiKey: provider.apiKey.trim(),
    model: model.modelId.trim(),
    providerLabel: provider.displayName.trim(),
    anthropicVersion: provider.anthropicVersion.trim() || "2023-06-01",
  };
}

export function syncLegacyApiProvider(
  providers: ModelProviderInstance[],
  selection: ApiModelSelection | null | undefined,
  legacy: ApiProviderConfig,
): ApiProviderConfig {
  const fromSelection = selectionToApiConfig(providers, selection);
  if (fromSelection.enabled && fromSelection.model) {
    return fromSelection;
  }
  if (legacy.enabled && legacy.model.trim() && legacy.baseUrl.trim()) {
    return legacy;
  }
  return { ...DEFAULT_API_PROVIDER_CONFIG, enabled: false };
}

export function migrateLegacyApiProvider(
  apiProvider: ApiProviderConfig,
): ModelProviderInstance[] {
  if (!apiProvider.enabled && !apiProvider.baseUrl.trim() && !apiProvider.model.trim()) {
    return [];
  }

  const vendorId: ModelProviderVendorId =
    apiProvider.protocol === "anthropic" ? "custom-anthropic" : "custom-openai";

  const models: ModelEntry[] = [];
  if (apiProvider.model.trim()) {
    models.push({
      id: createModelEntryId(),
      modelId: apiProvider.model.trim(),
      label: apiProvider.model.trim(),
      type: "llm",
      enabled: true,
    });
  }

  return [
    {
      id: createProviderId(),
      vendorId,
      enabled: apiProvider.enabled,
      displayName: apiProvider.providerLabel.trim() || "OpenAI Compatible",
      protocol: apiProvider.protocol,
      baseUrl: apiProvider.baseUrl.trim() || DEFAULT_API_PROVIDER_CONFIG.baseUrl,
      apiKey: apiProvider.apiKey,
      anthropicVersion: apiProvider.anthropicVersion || "2023-06-01",
      models,
      createdAt: new Date().toISOString(),
    },
  ];
}

export function inferModelType(modelId: string): ModelCapabilityType {
  const id = modelId.toLowerCase();
  if (
    id.includes("embed") ||
    id.includes("bge-") ||
    id.includes("text-embedding")
  ) {
    return "embedding";
  }
  if (id.includes("rerank") || id.includes("re-rank")) {
    return "rerank";
  }
  if (
    id.includes("vision") ||
    id.includes("4o") ||
    id.includes("claude-3") ||
    id.includes("gemini") ||
    id.includes("vl-") ||
    id.includes("multimodal")
  ) {
    return "multimodal";
  }
  return "llm";
}

export function groupModelsByType(
  models: ModelEntry[],
): Record<ModelCapabilityType, ModelEntry[]> {
  const grouped = Object.fromEntries(
    MODEL_CAPABILITY_ORDER.map((type) => [type, [] as ModelEntry[]]),
  ) as Record<ModelCapabilityType, ModelEntry[]>;

  for (const model of models) {
    grouped[model.type].push(model);
  }
  return grouped;
}

export function providerCapabilityTypes(
  provider: ModelProviderInstance,
): ModelCapabilityType[] {
  const types = new Set<ModelCapabilityType>();
  for (const model of provider.models) {
    if (model.enabled) types.add(model.type);
  }
  const vendor = vendorById(provider.vendorId);
  if (types.size === 0 && vendor) {
    return vendor.supportedTypes;
  }
  return MODEL_CAPABILITY_ORDER.filter((t) => types.has(t));
}