export type ChatExecutionSource = "cli" | "api";

export type ApiProviderProtocol = "openai" | "anthropic";

export type ApiProviderConfig = {
  enabled: boolean;
  protocol: ApiProviderProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  providerLabel: string;
  anthropicVersion: string;
};

export const DEFAULT_API_PROVIDER_CONFIG: ApiProviderConfig = {
  enabled: false,
  protocol: "openai",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "",
  providerLabel: "OpenAI Compatible",
  anthropicVersion: "2023-06-01",
};

/**
 * 检查 API Provider 配置是否可用于对话（需要模型）
 */
export function hasUsableApiProviderConfig(
  config: Pick<ApiProviderConfig, "enabled" | "baseUrl" | "model"> | null | undefined,
): boolean {
  return !!(
    config?.enabled &&
    config.baseUrl.trim().length > 0 &&
    config.model.trim().length > 0
  );
}

/**
 * 检查 API Provider 配置是否可用于测试连接和拉取模型（只需要 URL 和 Key）
 */
export function hasConnectableApiProviderConfig(
  config: Pick<ApiProviderConfig, "enabled" | "baseUrl" | "apiKey"> | null | undefined,
): boolean {
  return !!(
    config?.enabled &&
    config.baseUrl.trim().length > 0 &&
    config.apiKey.trim().length > 0
  );
}

export function providerDisplayName(
  config: Pick<ApiProviderConfig, "providerLabel" | "protocol">,
): string {
  const label = config.providerLabel.trim();
  if (label) return label;
  return config.protocol === "anthropic" ? "Anthropic" : "OpenAI Compatible";
}

export function trimApiProviderConfig(
  config: ApiProviderConfig,
): ApiProviderConfig {
  return {
    ...config,
    baseUrl: config.baseUrl.trim(),
    apiKey: config.apiKey.trim(),
    model: config.model.trim(),
    providerLabel: config.providerLabel.trim(),
    anthropicVersion: config.anthropicVersion.trim() || "2023-06-01",
  };
}

export type ApiProviderModelOption = {
  id: string;
  label: string;
};
