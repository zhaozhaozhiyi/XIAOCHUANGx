import {
  anthropicCredentialSchema,
  credentialsConnectable,
  credentialsToApiFields,
  getInitialCredentials,
  openAiCompatCredentialSchema,
  type CredentialFormSchema,
  type CredentialValues,
  validateCredentials,
} from "@/lib/byok/credential-schema";
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
  | "gemini"
  | "groq"
  | "mistral"
  | "xai"
  | "ollama"
  | "xinference"
  | "moonshot"
  | "zhipu"
  | "siliconflow"
  | "tongyi"
  | "baichuan"
  | "minimax"
  | "custom-openai"
  | "custom-anthropic";

/** 添加厂商网格分组 — 对齐 Dify 国内 / 国际 / 本地 */
export type ModelProviderVendorCategory = "cn" | "intl" | "local";

export const MODEL_PROVIDER_VENDOR_CATEGORY_LABELS: Record<
  ModelProviderVendorCategory,
  string
> = {
  cn: "国内",
  intl: "国际",
  local: "本地 / 自托管",
};

export const MODEL_PROVIDER_VENDOR_CATEGORY_ORDER: ModelProviderVendorCategory[] =
  ["cn", "intl", "local"];

export type ModelProviderVendor = {
  id: ModelProviderVendorId;
  name: string;
  description: string;
  protocol: ApiProviderProtocol;
  defaultBaseUrl: string;
  supportedTypes: ModelCapabilityType[];
  category: ModelProviderVendorCategory;
  /** 品牌色，用于卡片左侧条 */
  accent: string;
  credentialSchema: CredentialFormSchema[];
};

function vendorCredentialSchema(
  protocol: ApiProviderProtocol,
  defaultBaseUrl: string,
  options?: { keyOptional?: boolean },
): CredentialFormSchema[] {
  if (protocol === "anthropic") {
    return anthropicCredentialSchema(defaultBaseUrl);
  }
  return openAiCompatCredentialSchema(defaultBaseUrl, options);
}

export const MODEL_PROVIDER_VENDORS: ModelProviderVendor[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "DeepSeek 文本与推理模型",
    protocol: "openai",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    supportedTypes: ["llm"],
    category: "cn",
    accent: "#4d6bfe",
    credentialSchema: vendorCredentialSchema(
      "openai",
      "https://api.deepseek.com/v1",
    ),
  },
  {
    id: "moonshot",
    name: "Moonshot",
    description: "Kimi 开放平台",
    protocol: "openai",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    supportedTypes: ["llm", "multimodal"],
    category: "cn",
    accent: "#000000",
    credentialSchema: vendorCredentialSchema(
      "openai",
      "https://api.moonshot.cn/v1",
    ),
  },
  {
    id: "zhipu",
    name: "智谱 AI",
    description: "GLM 系列模型",
    protocol: "openai",
    defaultBaseUrl: "https://open.bigmodel.cn/api/paas/v4",
    supportedTypes: ["llm", "multimodal", "embedding"],
    category: "cn",
    accent: "#1a56db",
    credentialSchema: vendorCredentialSchema(
      "openai",
      "https://open.bigmodel.cn/api/paas/v4",
    ),
  },
  {
    id: "tongyi",
    name: "通义千问",
    description: "阿里云 DashScope 兼容模式",
    protocol: "openai",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    supportedTypes: ["llm", "multimodal", "embedding"],
    category: "cn",
    accent: "#615ced",
    credentialSchema: vendorCredentialSchema(
      "openai",
      "https://dashscope.aliyuncs.com/compatible-mode/v1",
    ),
  },
  {
    id: "siliconflow",
    name: "硅基流动",
    description: "国内模型聚合与推理托管",
    protocol: "openai",
    defaultBaseUrl: "https://api.siliconflow.cn/v1",
    supportedTypes: ["llm", "multimodal", "embedding"],
    category: "cn",
    accent: "#7c3aed",
    credentialSchema: vendorCredentialSchema(
      "openai",
      "https://api.siliconflow.cn/v1",
    ),
  },
  {
    id: "baichuan",
    name: "百川智能",
    description: "Baichuan 系列文本模型",
    protocol: "openai",
    defaultBaseUrl: "https://api.baichuan-ai.com/v1",
    supportedTypes: ["llm", "multimodal"],
    category: "cn",
    accent: "#2563eb",
    credentialSchema: vendorCredentialSchema(
      "openai",
      "https://api.baichuan-ai.com/v1",
    ),
  },
  {
    id: "minimax",
    name: "MiniMax",
    description: "MiniMax 文本与多模态模型",
    protocol: "openai",
    defaultBaseUrl: "https://api.minimax.chat/v1",
    supportedTypes: ["llm", "multimodal"],
    category: "cn",
    accent: "#111827",
    credentialSchema: vendorCredentialSchema(
      "openai",
      "https://api.minimax.chat/v1",
    ),
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT 系列文本与多模态模型",
    protocol: "openai",
    defaultBaseUrl: "https://api.openai.com/v1",
    supportedTypes: ["llm", "multimodal", "embedding"],
    category: "intl",
    accent: "#10a37f",
    credentialSchema: vendorCredentialSchema(
      "openai",
      "https://api.openai.com/v1",
    ),
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude 系列 Messages API",
    protocol: "anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
    supportedTypes: ["llm", "multimodal"],
    category: "intl",
    accent: "#cc785c",
    credentialSchema: vendorCredentialSchema(
      "anthropic",
      "https://api.anthropic.com",
    ),
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Gemini 系列（OpenAI 兼容端点）",
    protocol: "openai",
    defaultBaseUrl:
      "https://generativelanguage.googleapis.com/v1beta/openai/",
    supportedTypes: ["llm", "multimodal"],
    category: "intl",
    accent: "#4285f4",
    credentialSchema: vendorCredentialSchema(
      "openai",
      "https://generativelanguage.googleapis.com/v1beta/openai/",
    ),
  },
  {
    id: "groq",
    name: "Groq",
    description: "Groq 高速推理 OpenAI 兼容 API",
    protocol: "openai",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    supportedTypes: ["llm", "multimodal"],
    category: "intl",
    accent: "#f55036",
    credentialSchema: vendorCredentialSchema(
      "openai",
      "https://api.groq.com/openai/v1",
    ),
  },
  {
    id: "mistral",
    name: "Mistral",
    description: "Mistral / Mixtral 系列模型",
    protocol: "openai",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    supportedTypes: ["llm", "multimodal", "embedding"],
    category: "intl",
    accent: "#ff7000",
    credentialSchema: vendorCredentialSchema(
      "openai",
      "https://api.mistral.ai/v1",
    ),
  },
  {
    id: "xai",
    name: "xAI",
    description: "Grok 系列模型（OpenAI 兼容 API）",
    protocol: "openai",
    defaultBaseUrl: "https://api.x.ai/v1",
    supportedTypes: ["llm", "multimodal"],
    category: "intl",
    accent: "#0a0a0a",
    credentialSchema: vendorCredentialSchema("openai", "https://api.x.ai/v1"),
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "聚合多家模型的 OpenAI 兼容网关",
    protocol: "openai",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    supportedTypes: ["llm", "multimodal"],
    category: "intl",
    accent: "#6366f1",
    credentialSchema: vendorCredentialSchema(
      "openai",
      "https://openrouter.ai/api/v1",
    ),
  },
  {
    id: "azure-openai",
    name: "Azure OpenAI",
    description: "企业 Azure 托管 OpenAI 服务",
    protocol: "openai",
    defaultBaseUrl:
      "https://{resource}.openai.azure.com/openai/deployments/{deployment}",
    supportedTypes: ["llm", "multimodal", "embedding"],
    category: "intl",
    accent: "#0078d4",
    credentialSchema: vendorCredentialSchema(
      "openai",
      "https://{resource}.openai.azure.com/openai/deployments/{deployment}",
    ),
  },
  {
    id: "custom-openai",
    name: "自定义 OpenAI 兼容",
    description: "任意 OpenAI 兼容网关或企业代理",
    protocol: "openai",
    defaultBaseUrl: "https://api.openai.com/v1",
    supportedTypes: ["llm", "multimodal", "embedding", "rerank"],
    category: "intl",
    accent: "#87867f",
    credentialSchema: vendorCredentialSchema(
      "openai",
      "https://api.openai.com/v1",
    ),
  },
  {
    id: "custom-anthropic",
    name: "自定义 Anthropic",
    description: "Anthropic Messages API 兼容服务",
    protocol: "anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
    supportedTypes: ["llm", "multimodal"],
    category: "intl",
    accent: "#87867f",
    credentialSchema: vendorCredentialSchema(
      "anthropic",
      "https://api.anthropic.com",
    ),
  },
  {
    id: "ollama",
    name: "Ollama",
    description: "本地 OpenAI 兼容推理服务",
    protocol: "openai",
    defaultBaseUrl: "http://localhost:11434/v1",
    supportedTypes: ["llm", "multimodal", "embedding"],
    category: "local",
    accent: "#ffffff",
    credentialSchema: vendorCredentialSchema("openai", "http://localhost:11434/v1", {
      keyOptional: true,
    }),
  },
  {
    id: "xinference",
    name: "Xinference",
    description: "本地模型推理框架（OpenAI 兼容）",
    protocol: "openai",
    defaultBaseUrl: "http://localhost:9997/v1",
    supportedTypes: ["llm", "multimodal", "embedding", "rerank"],
    category: "local",
    accent: "#0ea5e9",
    credentialSchema: vendorCredentialSchema(
      "openai",
      "http://localhost:9997/v1",
      { keyOptional: true },
    ),
  },
];

export function vendorsByCategory(
  category: ModelProviderVendorCategory,
): ModelProviderVendor[] {
  return MODEL_PROVIDER_VENDORS.filter((v) => v.category === category);
}

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
  credentials: CredentialValues;
  models: ModelEntry[];
  /** 测试连接通过后为 true；仅已验证实例出现在「已配置的厂商」列表 */
  connectionVerified: boolean;
  createdAt: string;
};

/** @deprecated 旧版 localStorage 字段，仅用于迁移 */
export type LegacyModelProviderFields = {
  baseUrl?: string;
  apiKey?: string;
  anthropicVersion?: string;
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

export function providerCredentialSchema(
  provider: ModelProviderInstance,
): CredentialFormSchema[] {
  return vendorById(provider.vendorId)?.credentialSchema ?? [];
}

export function createProviderId(): string {
  return `mp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createModelEntryId(): string {
  return `md_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeProviderInstance(
  raw: Partial<ModelProviderInstance> & LegacyModelProviderFields,
): ModelProviderInstance {
  const vendorId = raw.vendorId ?? "custom-openai";
  const vendor = vendorById(vendorId) ?? MODEL_PROVIDER_VENDORS[0]!;
  const schema = vendor.credentialSchema;

  const credentials: CredentialValues = {
    ...getInitialCredentials(schema),
    ...(raw.credentials ?? {}),
  };

  if (raw.baseUrl !== undefined && !raw.credentials?.base_url) {
    credentials.base_url = raw.baseUrl;
  }
  if (raw.apiKey !== undefined && !raw.credentials?.api_key) {
    credentials.api_key = raw.apiKey;
  }
  if (
    raw.anthropicVersion !== undefined &&
    !raw.credentials?.anthropic_version
  ) {
    credentials.anthropic_version = raw.anthropicVersion;
  }

  const instance: ModelProviderInstance = {
    id: raw.id ?? createProviderId(),
    vendorId,
    enabled: raw.enabled ?? true,
    displayName: raw.displayName ?? vendor.name,
    protocol: raw.protocol ?? vendor.protocol,
    credentials,
    models: raw.models ?? [],
    connectionVerified: raw.connectionVerified ?? false,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };

  if (hasUsableProviderInstance(instance)) {
    instance.connectionVerified = true;
  }

  return instance;
}

/** 加载设置时剔除未验证且无可用模型的空壳实例 */
export function pruneUnverifiedProviders(
  providers: ModelProviderInstance[],
): ModelProviderInstance[] {
  return providers.filter((p) => p.connectionVerified);
}

export function isListedProvider(provider: ModelProviderInstance): boolean {
  return provider.connectionVerified;
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
    credentials: getInitialCredentials(vendor.credentialSchema),
    models: [],
    connectionVerified: false,
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

  const { baseUrl, apiKey, anthropicVersion } = credentialsToApiFields(
    provider.credentials,
  );

  return {
    enabled: provider.enabled,
    protocol: provider.protocol,
    baseUrl,
    apiKey,
    model: llm?.modelId ?? "",
    providerLabel:
      provider.displayName.trim() ||
      vendorById(provider.vendorId)?.name ||
      "Model API",
    anthropicVersion,
  };
}

export function hasConnectableProviderInstance(
  provider: ModelProviderInstance,
): boolean {
  if (!provider.enabled) return false;
  return credentialsConnectable(
    providerCredentialSchema(provider),
    provider.credentials,
  );
}

export function hasUsableProviderInstance(
  provider: ModelProviderInstance,
): boolean {
  if (!hasConnectableProviderInstance(provider)) return false;
  return provider.models.some(
    (m) => m.enabled && m.type === "llm" && m.modelId.trim(),
  );
}

export function hasAnyUsableProvider(
  providers: ModelProviderInstance[] | undefined,
): boolean {
  return (providers ?? []).some(hasUsableProviderInstance);
}

export function hasAnyConnectableProvider(
  providers: ModelProviderInstance[] | undefined,
): boolean {
  return (providers ?? []).some(hasConnectableProviderInstance);
}

export function getProviderValidationMissing(
  provider: ModelProviderInstance,
): string[] {
  return validateCredentials(
    providerCredentialSchema(provider),
    provider.credentials,
  );
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
  const { baseUrl, apiKey, anthropicVersion } = credentialsToApiFields(
    provider.credentials,
  );
  return {
    enabled: provider.enabled,
    protocol: provider.protocol,
    baseUrl,
    apiKey,
    model: model.modelId.trim(),
    providerLabel: provider.displayName.trim(),
    anthropicVersion,
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
  if (!apiProvider.model.trim()) {
    return [];
  }

  const vendorId: ModelProviderVendorId =
    apiProvider.protocol === "anthropic" ? "custom-anthropic" : "custom-openai";

  const vendor = vendorById(vendorId)!;
  const credentials = getInitialCredentials(vendor.credentialSchema);
  credentials.base_url =
    apiProvider.baseUrl.trim() || DEFAULT_API_PROVIDER_CONFIG.baseUrl;
  credentials.api_key = apiProvider.apiKey;
  credentials.anthropic_version =
    apiProvider.anthropicVersion || "2023-06-01";

  const models: ModelEntry[] = [
    {
      id: createModelEntryId(),
      modelId: apiProvider.model.trim(),
      label: apiProvider.model.trim(),
      type: "llm",
      enabled: true,
    },
  ];

  return [
    normalizeProviderInstance({
      id: createProviderId(),
      vendorId,
      enabled: apiProvider.enabled,
      displayName: apiProvider.providerLabel.trim() || "OpenAI Compatible",
      protocol: apiProvider.protocol,
      credentials,
      models,
      connectionVerified: true,
      createdAt: new Date().toISOString(),
    }),
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
