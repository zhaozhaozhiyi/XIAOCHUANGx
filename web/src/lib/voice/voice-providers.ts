/** 语音模型能力 — 对齐 Dify speech2text / TTS 分类 */
export type VoiceCapabilityType = "stt" | "tts";

export const VOICE_CAPABILITY_LABELS: Record<VoiceCapabilityType, string> = {
  stt: "语音识别",
  tts: "语音合成",
};

export const VOICE_CAPABILITY_ORDER: VoiceCapabilityType[] = ["stt", "tts"];

export type VoiceProviderVendorId =
  | "openai"
  | "azure-speech"
  | "alibaba"
  | "tencent"
  | "elevenlabs"
  | "google"
  | "custom";

export type VoiceProviderVendor = {
  id: VoiceProviderVendorId;
  name: string;
  description: string;
  defaultBaseUrl: string;
  supportedTypes: VoiceCapabilityType[];
  accent: string;
};

export const VOICE_PROVIDER_VENDORS: VoiceProviderVendor[] = [
  {
    id: "openai",
    name: "OpenAI",
    description: "Whisper 语音识别 · TTS 语音合成",
    defaultBaseUrl: "https://api.openai.com/v1",
    supportedTypes: ["stt", "tts"],
    accent: "#10a37f",
  },
  {
    id: "azure-speech",
    name: "Azure Speech",
    description: "微软 Azure 认知语音服务",
    defaultBaseUrl: "https://{region}.api.cognitive.microsoft.com",
    supportedTypes: ["stt", "tts"],
    accent: "#0078d4",
  },
  {
    id: "alibaba",
    name: "阿里云",
    description: "智能语音交互 · 语音合成",
    defaultBaseUrl: "https://nls-gateway-cn-shanghai.aliyuncs.com",
    supportedTypes: ["stt", "tts"],
    accent: "#ff6a00",
  },
  {
    id: "tencent",
    name: "腾讯云",
    description: "语音识别 ASR · 语音合成 TTS",
    defaultBaseUrl: "https://tts.tencentcloudapi.com",
    supportedTypes: ["stt", "tts"],
    accent: "#006eff",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    description: "高质量多语言 TTS 合成",
    defaultBaseUrl: "https://api.elevenlabs.io/v1",
    supportedTypes: ["tts"],
    accent: "#000000",
  },
  {
    id: "google",
    name: "Google Cloud",
    description: "Speech-to-Text · Text-to-Speech",
    defaultBaseUrl: "https://speech.googleapis.com/v1",
    supportedTypes: ["stt", "tts"],
    accent: "#4285f4",
  },
  {
    id: "custom",
    name: "自定义",
    description: "企业自建或第三方 OpenAI 兼容语音网关",
    defaultBaseUrl: "https://api.example.com/v1",
    supportedTypes: ["stt", "tts"],
    accent: "#87867f",
  },
];

export type VoiceModelEntry = {
  id: string;
  modelId: string;
  label: string;
  type: VoiceCapabilityType;
  /** TTS 可选：音色 / voice id */
  voiceId?: string;
  /** TTS 可选：语言 */
  language?: string;
  enabled: boolean;
};

export type VoiceProviderInstance = {
  id: string;
  vendorId: VoiceProviderVendorId;
  enabled: boolean;
  displayName: string;
  baseUrl: string;
  apiKey: string;
  /** 部分厂商需要额外 Secret / AppId */
  appSecret: string;
  models: VoiceModelEntry[];
  createdAt: string;
};

export type VoiceModelSelection = {
  providerId: string;
  modelEntryId: string;
};

export function voiceVendorById(
  id: VoiceProviderVendorId,
): VoiceProviderVendor | undefined {
  return VOICE_PROVIDER_VENDORS.find((v) => v.id === id);
}

export function createVoiceProviderId(): string {
  return `vp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createVoiceModelEntryId(): string {
  return `vm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createVoiceProviderFromVendor(
  vendorId: VoiceProviderVendorId,
): VoiceProviderInstance {
  const vendor = voiceVendorById(vendorId) ?? VOICE_PROVIDER_VENDORS[0]!;
  return {
    id: createVoiceProviderId(),
    vendorId: vendor.id,
    enabled: true,
    displayName: vendor.name,
    baseUrl: vendor.defaultBaseUrl,
    apiKey: "",
    appSecret: "",
    models: [],
    createdAt: new Date().toISOString(),
  };
}

export function hasUsableVoiceProvider(
  provider: VoiceProviderInstance,
): boolean {
  return !!(
    provider.enabled &&
    provider.baseUrl.trim() &&
    provider.models.some((m) => m.enabled && m.modelId.trim())
  );
}

export function hasAnyUsableVoiceProvider(
  providers: VoiceProviderInstance[] | undefined,
): boolean {
  return (providers ?? []).some(hasUsableVoiceProvider);
}

export function getVoiceModelsByType(
  providers: VoiceProviderInstance[],
  type: VoiceCapabilityType,
): Array<{ provider: VoiceProviderInstance; model: VoiceModelEntry }> {
  const items: Array<{
    provider: VoiceProviderInstance;
    model: VoiceModelEntry;
  }> = [];
  for (const provider of providers) {
    if (!provider.enabled) continue;
    for (const model of provider.models) {
      if (!model.enabled || model.type !== type || !model.modelId.trim()) {
        continue;
      }
      items.push({ provider, model });
    }
  }
  return items;
}

export function resolveVoiceSelection(
  providers: VoiceProviderInstance[],
  selection: VoiceModelSelection | null | undefined,
  type: VoiceCapabilityType,
): VoiceModelSelection | null {
  if (!selection) return null;
  const provider = providers.find((p) => p.id === selection.providerId);
  const model = provider?.models.find((m) => m.id === selection.modelEntryId);
  if (!provider || !model || !model.enabled || model.type !== type) {
    return null;
  }
  return selection;
}

export function defaultVoiceSelection(
  providers: VoiceProviderInstance[],
  type: VoiceCapabilityType,
): VoiceModelSelection | null {
  const first = getVoiceModelsByType(providers, type)[0];
  if (!first) return null;
  return { providerId: first.provider.id, modelEntryId: first.model.id };
}

export function groupVoiceModelsByType(
  models: VoiceModelEntry[],
): Record<VoiceCapabilityType, VoiceModelEntry[]> {
  const grouped = Object.fromEntries(
    VOICE_CAPABILITY_ORDER.map((type) => [type, [] as VoiceModelEntry[]]),
  ) as Record<VoiceCapabilityType, VoiceModelEntry[]>;
  for (const model of models) {
    grouped[model.type].push(model);
  }
  return grouped;
}

export function providerVoiceCapabilityTypes(
  provider: VoiceProviderInstance,
): VoiceCapabilityType[] {
  const types = new Set<VoiceCapabilityType>();
  for (const model of provider.models) {
    if (model.enabled) types.add(model.type);
  }
  const vendor = voiceVendorById(provider.vendorId);
  if (types.size === 0 && vendor) {
    return vendor.supportedTypes;
  }
  return VOICE_CAPABILITY_ORDER.filter((t) => types.has(t));
}

export const VOICE_MODEL_PRESETS: Record<
  VoiceProviderVendorId,
  Partial<Record<VoiceCapabilityType, Array<{ modelId: string; label: string }>>>
> = {
  openai: {
    stt: [{ modelId: "whisper-1", label: "Whisper v1" }],
    tts: [
      { modelId: "tts-1", label: "TTS Standard" },
      { modelId: "tts-1-hd", label: "TTS HD" },
    ],
  },
  "azure-speech": {
    stt: [{ modelId: "zh-CN", label: "中文普通话" }],
    tts: [{ modelId: "zh-CN-XiaoxiaoNeural", label: "晓晓（女声）" }],
  },
  alibaba: {
    stt: [{ modelId: "paraformer-realtime-v2", label: "Paraformer 实时" }],
    tts: [{ modelId: "xiaoyun", label: "小云（女声）" }],
  },
  tencent: {
    stt: [{ modelId: "16k_zh", label: "16k 中文" }],
    tts: [{ modelId: "101001", label: "智瑜（女声）" }],
  },
  elevenlabs: {
    tts: [{ modelId: "eleven_multilingual_v2", label: "Multilingual v2" }],
  },
  google: {
    stt: [{ modelId: "latest_long", label: "Long Audio" }],
    tts: [{ modelId: "zh-CN-Wavenet-A", label: "Wavenet 中文 A" }],
  },
  custom: {},
};
