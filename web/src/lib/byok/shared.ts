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

const PROVIDER_ERROR_PREFIXES = [
  "Base URL 格式无效",
  "仅支持 http / https Provider 地址",
  "禁止访问私有网络 Provider 地址",
  "Provider 地址解析失败",
  "Provider Base URL 为空",
  "Provider Model ID 为空",
  "Provider URL 验证失败",
  "无法解析 Provider 域名",
  "无法连接到 Provider 地址",
  "连接 Provider 超时",
  "Provider SSL 证书验证失败",
  "网络请求失败",
  "Provider 网络错误",
] as const;

export function redactSensitiveText(input: string): string {
  if (!input) return "";

  return input
    .replace(/sk-[A-Za-z0-9][A-Za-z0-9*._-]{5,}/g, "[已隐藏的 API Key]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [已隐藏]")
    .replace(
      /([\"']?(?:x-)?api[_ -]?key[\"']?\s*[:=]\s*[\"']?)[^\"',\s}]+/gi,
      "$1[已隐藏]",
    );
}

function normalizeProviderDetail(input: string): string {
  return redactSensitiveText(input).replace(/\s+/g, " ").trim();
}

export function toUserFacingProviderError(input: {
  detail?: string | null | undefined;
  status?: number | null | undefined;
  fallback?: string | null | undefined;
}): string {
  const detail = normalizeProviderDetail(input.detail ?? "");
  const fallback =
    input.fallback?.trim() || "Provider 请求失败，请检查地址、API Key 与模型配置。";
  const lower = detail.toLowerCase();
  const status = input.status ?? undefined;

  if (!detail) {
    if (status === 401) {
      return "API Key 校验失败，请检查当前 Provider 的 API Key 是否正确，并确认它与 Provider 地址属于同一服务商。";
    }
    if (status === 404) {
      return "模型或接口地址不可用，请确认 Provider 地址和模型 ID 是否填写正确。";
    }
    if (status === 429) {
      return "请求过于频繁或已达到限流，请稍后重试。";
    }
    if (status && status >= 500) {
      return "Provider 服务暂时不可用，请稍后重试。";
    }
    return fallback;
  }

  if (PROVIDER_ERROR_PREFIXES.some((prefix) => detail.startsWith(prefix))) {
    return detail;
  }

  if (
    status === 401 ||
    lower.startsWith("provider_error_401") ||
    lower.includes("invalid_api_key") ||
    lower.includes("incorrect api key") ||
    lower.includes("invalid x-api-key") ||
    lower.includes("unauthorized") ||
    lower.includes("authentication")
  ) {
    return "API Key 校验失败，请检查当前 Provider 的 API Key 是否正确、是否过期，并确认它与 Provider 地址属于同一服务商。";
  }

  if (
    status === 404 ||
    lower.startsWith("provider_error_404") ||
    lower.includes("model_not_found") ||
    lower.includes("unknown model") ||
    lower.includes("does not exist")
  ) {
    return "模型 ID 不可用，请确认该 Provider 支持当前模型，并检查模型名称是否填写正确。";
  }

  if (
    status === 429 ||
    lower.startsWith("provider_error_429") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests")
  ) {
    return "请求过于频繁或已达到限流，请稍后重试，或检查该 Provider 的速率限制。";
  }

  if (
    status === 403 ||
    lower.startsWith("provider_error_403") ||
    lower.includes("insufficient_quota") ||
    lower.includes("quota") ||
    lower.includes("billing") ||
    lower.includes("permission")
  ) {
    return "账号额度或权限不足，请检查配额、计费状态，以及当前模型的访问权限。";
  }

  if (status && status >= 500) {
    return "Provider 服务暂时不可用，请稍后重试。";
  }

  if (
    detail.startsWith("{") ||
    detail.startsWith("[") ||
    lower.includes('"error"') ||
    lower.includes('"message"')
  ) {
    return fallback;
  }

  return detail || fallback;
}
